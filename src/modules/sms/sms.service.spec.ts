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
    expect(db.smsLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        phone: expect.stringMatching(/^\+966\*+01$/),
        message: expect.not.stringContaining('123456'),
      }),
    });
    expect(db.smsLog.update).toHaveBeenCalledWith({
      where: { id: 'sms-log-1' },
      data: expect.objectContaining({ status: 'failed' }),
    });
  });

  it('redacts OTP code from logged message content', async () => {
    const db = {
      smsLog: {
        create: jest.fn().mockResolvedValue({ id: 'sms-log-2' }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new SmsService(
      db as never,
      { get: jest.fn() } as never,
      { t: (_key: string, opts: any) => `Your OTP is ${opts.args.code}` } as never,
    );

    await service.sendDeliveryOtp({
      phone: '+966512345678',
      recipientName: 'Demo',
      trackingCode: 'TRACK1',
      code: '654321',
      senderName: 'Store',
      tenantId: 't-1',
      orderId: 'o-1',
    });

    expect(db.smsLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        phone: expect.stringMatching(/^\+966\*+78$/),
        message: 'Your OTP is ******',
        template: 'otp.delivery',
      }),
    });
  });
});
