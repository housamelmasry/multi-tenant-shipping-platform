// src/modules/webhooks/dto/create-webhook.dto.ts
import { IsUrl, IsString, IsArray, IsIn, ArrayMinSize } from 'class-validator';

// كل الأحداث الممكنة
export const WEBHOOK_EVENTS = [
  'order.created',
  'order.assigned',
  'order.picked_up',
  'order.in_transit',
  'order.delivered',
  'order.failed',
  'order.cancelled',
  'order.returned',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export class CreateWebhookDto {
  @IsUrl({ require_tld: false }) // require_tld: false للـ development
  url: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(WEBHOOK_EVENTS, { each: true })
  events: WebhookEvent[];
}
