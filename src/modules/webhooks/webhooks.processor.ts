// src/modules/webhooks/webhooks.processor.ts
import {
  Processor,
  Process,
  OnQueueFailed,
  OnQueueCompleted,
} from '@nestjs/bull';
import type { Job } from 'bull';
import { HttpService } from '@nestjs/axios';
import { DatabaseService } from '@database/database.service';
import { WebhookJobData, WebhookPayload } from './types/webhook-job.type';
import { WEBHOOK_QUEUE } from './webhooks.service';
import * as crypto from 'crypto';
import { firstValueFrom } from 'rxjs';
import {
  createPinnedWebhookAgents,
  resolvePublicWebhookUrl,
} from './webhook-target.util';

export function createWebhookSignature(
  payload: WebhookPayload,
  secret: string,
  timestamp: string,
): string {
  const signedPayload = `${timestamp}.${JSON.stringify(payload)}`;
  return `sha256=${crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex')}`;
}

@Processor(WEBHOOK_QUEUE)
export class WebhooksProcessor {
  constructor(
    private http: HttpService,
    private db: DatabaseService,
  ) {}

  @Process('send')
  async handleSend(job: Job<WebhookJobData>) {
    const { webhookLogId, url, secret, event, payload } = job.data;

    const timestamp = Date.now().toString();
    const signature = createWebhookSignature(payload, secret, timestamp);
    let agents: ReturnType<typeof createPinnedWebhookAgents> | undefined;

    try {
      const target = await resolvePublicWebhookUrl(url);
      agents = createPinnedWebhookAgents(target.addresses);
      const response = await firstValueFrom(
        this.http.post(target.url.toString(), payload, {
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Event': event,
            'X-Webhook-Signature': signature,
            'X-Webhook-Timestamp': timestamp,
            'X-Webhook-Delivery-Id': webhookLogId,
          },
          timeout: 10000, // Maximum timeout: 10 seconds.
          maxRedirects: 0,
          proxy: false,
          httpAgent: agents.httpAgent,
          httpsAgent: agents.httpsAgent,
        }),
      );

      // ✅ Update the log after a successful delivery.
      await this.db.webhookLog.update({
        where: { id: webhookLogId },
        data: {
          status: 'success',
          responseStatus: response.status,
          responseBody: JSON.stringify(response.data).slice(0, 1000),
          attempts: job.attemptsMade + 1,
          nextRetryAt: null,
        },
      });
    } catch (error) {
      const response =
        isRecord(error) && isRecord(error.response)
          ? error.response
          : undefined;
      const responseStatus =
        typeof response?.status === 'number' ? response.status : undefined;
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const responseBody = JSON.stringify(response?.data ?? errorMessage).slice(
        0,
        1000,
      );
      const isLastAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 5);

      // Calculate when to make the next attempt.
      const nextRetryAt = isLastAttempt
        ? null
        : new Date(Date.now() + this.getBackoffDelay(job.attemptsMade + 1));

      await this.db.webhookLog.update({
        where: { id: webhookLogId },
        data: {
          status: isLastAttempt ? 'failed' : 'pending',
          responseStatus,
          responseBody,
          attempts: job.attemptsMade + 1,
          nextRetryAt,
        },
      });

      // Rethrow the error so Bull retries the job.
      throw error;
    } finally {
      agents?.httpAgent.destroy();
      agents?.httpsAgent.destroy();
    }
  }

  @OnQueueFailed()
  onFailed(job: Job<WebhookJobData>, error: Error) {
    console.error(
      `❌ Webhook failed | Job: ${job.id} | URL: ${job.data.url} | Error: ${error.message}`,
    );
  }

  @OnQueueCompleted()
  onCompleted(job: Job<WebhookJobData>) {
    console.log(`✅ Webhook sent | Job: ${job.id} | Event: ${job.data.event}`);
  }

  // exponential backoff: 2s, 4s, 8s, 16s, 32s
  private getBackoffDelay(attempt: number): number {
    return Math.min(2000 * Math.pow(2, attempt - 1), 32000);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
