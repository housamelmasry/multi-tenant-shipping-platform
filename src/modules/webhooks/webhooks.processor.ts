// src/modules/webhooks/webhooks.processor.ts
import {
  Processor,
  Process,
  OnQueueFailed,
  OnQueueCompleted,
} from '@nestjs/bull';
import { Job } from 'bull';
import { HttpService } from '@nestjs/axios';
import { DatabaseService } from '@database/database.service';
import { WebhookJobData } from './types/webhook-job.type';
import { WEBHOOK_QUEUE } from './webhooks.service';
import * as crypto from 'crypto';
import { firstValueFrom } from 'rxjs';

@Processor(WEBHOOK_QUEUE)
export class WebhooksProcessor {
  constructor(
    private http: HttpService,
    private db: DatabaseService,
  ) {}

  @Process('send')
  async handleSend(job: Job<WebhookJobData>) {
    const { webhookLogId, url, secret, event, payload } = job.data;

    // توليد الـ signature للأمان
    const signature = this.generateSignature(payload, secret);
    const timestamp = Date.now().toString();

    try {
      const response = await firstValueFrom(
        this.http.post(url, payload, {
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Event': event,
            'X-Webhook-Signature': signature,
            'X-Webhook-Timestamp': timestamp,
            'X-Webhook-Delivery-Id': webhookLogId,
          },
          timeout: 10000, // 10 ثواني max
        }),
      );

      // ✅ نجح → تحديث الـ log
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
      const responseStatus = error.response?.status;
      const responseBody = JSON.stringify(
        error.response?.data ?? error.message,
      ).slice(0, 1000);
      const isLastAttempt = job.attemptsMade + 1 >= job.opts.attempts;

      // حساب وقت المحاولة القادمة
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

      // إعادة throw عشان Bull يعمل retry
      throw error;
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

  // ─── Signature Generation ─────────────────────────────

  private generateSignature(payload: any, secret: string): string {
    const body = JSON.stringify(payload);
    return `sha256=${crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex')}`;
  }

  // exponential backoff: 2s, 4s, 8s, 16s, 32s
  private getBackoffDelay(attempt: number): number {
    return Math.min(2000 * Math.pow(2, attempt - 1), 32000);
  }
}
