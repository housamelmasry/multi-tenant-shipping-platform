import { SmsService } from './sms.service';

describe('SmsService', () => {
  it('does not report a message as sent when no provider is implemented', async () => {
    const db = {
      smsLog: {
        create: jest.fn().mockResolvedValue({ id: 'sms-log-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new SmsService(
      db as never,
      { get: jest.fn() } as never,
      { t: (key: string) => key } as never,
    );

    const result = await service.sendDeliveryOtp({
      phone: '+966500000001',
      recipientName: 'Demo Recipient',
      trackingCode: 'SHP-DEMO0001',
      code: '123456',
      senderName: 'Demo Store',
      tenantId: 'tenant-1',
      orderId: 'order-1',
      lang: 'en',
    });

    expect(result).toMatchObject({
      sent: false,
      reason: 'provider_unavailable',
    });
    expect(db.smsLog.update).toHaveBeenCalledWith({
      where: { id: 'sms-log-1' },
      data: expect.objectContaining({ status: 'failed' }),
    });
  });
});
