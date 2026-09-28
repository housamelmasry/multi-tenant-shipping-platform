import * as crypto from 'crypto';
import { createWebhookSignature } from './webhooks.processor';
import { WebhookPayload } from './types/webhook-job.type';

describe('webhook request signatures', () => {
  it('signs the timestamp and serialized payload together', () => {
    const payload = {
      event: 'order.created',
      timestamp: '2026-09-28T12:00:00.000Z',
      data: { id: 'order-1' },
    } as WebhookPayload;
    const secret = 'test-secret';
    const timestamp = '1790596800000';
    const expected = `sha256=${crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${JSON.stringify(payload)}`)
      .digest('hex')}`;

    expect(createWebhookSignature(payload, secret, timestamp)).toBe(expected);
    expect(createWebhookSignature(payload, secret, '1790596800001')).not.toBe(
      expected,
    );
  });
});
