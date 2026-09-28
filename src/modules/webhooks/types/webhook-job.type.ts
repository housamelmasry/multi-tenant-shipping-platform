// src/modules/webhooks/types/webhook-job.type.ts
import type { WebhookEvent } from '../dto/create-webhook.dto';

export type WebhookJobData = {
  webhookLogId: string;
  webhookId: string;
  tenantId: string;
  url: string;
  secret: string;
  event: WebhookEvent;
  payload: WebhookPayload;
  attempt: number;
  /**
   * Language of the originating request, carried so the worker can localize
   * anything it adds to the payload. The worker has no request context of its
   * own, so this cannot be recovered there.
   */
  lang?: string;
};

export type WebhookPayload = {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown> & { id: string };
};
