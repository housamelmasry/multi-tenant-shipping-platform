// src/modules/webhooks/types/webhook-job.type.ts
import { WebhookEvent } from '../dto/create-webhook.dto';

export type WebhookJobData = {
  webhookLogId: string;
  webhookId: string;
  tenantId: string;
  url: string;
  secret: string;
  event: WebhookEvent;
  payload: WebhookPayload;
  attempt: number;
};

export type WebhookPayload = {
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, any>;
};
