import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { OrdersOtpService } from './orders-otp.service';

describe('OrdersOtpService', () => {
  it('rejects verification after the order leaves the in-transit state', async () => {
    const db = {
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'order-1',
          tenantId: 'tenant-1',
          driverId: 'driver-1',
          status: 'FAILED',
          otpCode: '123456',
          otpExpiresAt: new Date(Date.now() + 60_000),
        }),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    const service = new OrdersOtpService(
      db as never,
      {} as never,
      {} as never,
      {} as never,
      { t: (key: string) => key } as never,
    );

    await expect(
      service.verify('order-1', 'tenant-1', 'driver-1', '123456'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('clears an OTP when SMS delivery is unavailable', async () => {
    const db = {
      order: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'order-1',
          tenantId: 'tenant-1',
          driverId: 'driver-1',
          status: 'IN_TRANSIT',
          recipientPhone: '+966500000001',
          recipientName: 'Demo Recipient',
          trackingCode: 'SHP-DEMO0001',
          tenant: { name: 'Demo Tenant' },
          recipientLang: 'en',
        }),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const service = new OrdersOtpService(
      db as never,
      {} as never,
      {
        sendDeliveryOtp: jest.fn().mockResolvedValue({ sent: false }),
      } as never,
      {} as never,
      { t: (key: string) => key } as never,
    );

    await expect(
      service.generateAndSend('order-1', 'tenant-1', 'driver-1'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(db.order.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'order-1' }),
      data: { otpCode: null, otpExpiresAt: null },
    });
  });
});
