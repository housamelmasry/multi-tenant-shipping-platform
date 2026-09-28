import { WebhooksService } from './webhooks.service';
import type { WebhookJobData } from './types/webhook-job.type';

describe('WebhooksService dispatch payload', () => {
  it('omits order OTP fields from stored and queued payloads', async () => {
    const webhook = {
      id: 'webhook-1',
      url: 'https://example.test/hook',
      secret: 'webhook-secret',
    };
    let storedPayload: { data: Record<string, unknown> } | undefined;
    let queuedPayload: WebhookJobData['payload'] | undefined;
    const createLog = jest.fn(
      (args: { data: { payload: { data: Record<string, unknown> } } }) => {
        storedPayload = args.data.payload;
        return Promise.resolve({ id: 'log-1' });
      },
    );
    const addJob = jest.fn((_name: string, jobData: WebhookJobData) => {
      queuedPayload = jobData.payload;
      return Promise.resolve(undefined);
    });
    const db = {
      webhook: { findMany: jest.fn().mockResolvedValue([webhook]) },
      webhookLog: { create: createLog },
    };
    const webhookQueue = { add: addJob };
    const service = new WebhooksService(
      db as never,
      webhookQueue as never,
      { t: (key: string) => key } as never,
    );

    await service.dispatch('tenant-1', 'order.created', {
      id: 'order-1',
      otpCode: '123456',
      otpExpiresAt: new Date('2026-09-28T12:00:00.000Z'),
      recipientName: 'Recipient',
    });

    expect(storedPayload?.data).toEqual({
      id: 'order-1',
      recipientName: 'Recipient',
    });
    expect(queuedPayload?.data).toEqual(storedPayload?.data);
  });
});
