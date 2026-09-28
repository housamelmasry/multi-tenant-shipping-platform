import { BadRequestException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrderStatus } from '@common/enums';

describe('OrdersService status & cancellation lifecycle', () => {
  it('clears otpCode and otpExpiresAt when an in-transit order is marked as FAILED', async () => {
    const mockOrder = {
      id: 'order-1',
      tenantId: 'tenant-1',
      driverId: 'driver-1',
      status: OrderStatus.IN_TRANSIT,
      trackingCode: 'TRACK1',
      recipientPhone: '+966500000001',
      recipientName: 'Recipient',
      recipientLang: 'en',
    };

    const db = {
      order: {
        findFirst: jest.fn().mockResolvedValue(mockOrder),
        update: jest.fn().mockResolvedValue({
          ...mockOrder,
          status: OrderStatus.FAILED,
          otpCode: null,
          otpExpiresAt: null,
        }),
      },
      orderStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    const trackingGateway = { emitOrderStatusUpdate: jest.fn() };
    const notificationsService = { notifyOrderCancelled: jest.fn() };
    const webhooksService = { dispatch: jest.fn() };
    const smsService = { sendOrderNotification: jest.fn() };
    const otpService = {};
    const i18n = { t: (key: string) => key };

    const service = new OrdersService(
      db as never,
      otpService as never,
      webhooksService as never,
      trackingGateway as never,
      notificationsService as never,
      smsService as never,
      i18n as never,
    );

    await service.updateStatus(
      'order-1',
      'tenant-1',
      { status: OrderStatus.FAILED, failedReason: 'Customer unreachable' },
      'driver-1',
    );

    expect(db.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({
        status: OrderStatus.FAILED,
        otpCode: null,
        otpExpiresAt: null,
        failedReason: 'Customer unreachable',
      }),
    });
  });

  it('clears otpCode and otpExpiresAt when an order is cancelled', async () => {
    const mockOrder = {
      id: 'order-1',
      tenantId: 'tenant-1',
      driverId: 'driver-1',
      status: OrderStatus.ASSIGNED,
      trackingCode: 'TRACK1',
    };

    const txMock = {
      order: {
        update: jest.fn().mockResolvedValue({
          ...mockOrder,
          status: OrderStatus.CANCELLED,
          otpCode: null,
          otpExpiresAt: null,
        }),
      },
      driver: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    const db = {
      order: {
        findFirst: jest.fn().mockResolvedValue(mockOrder),
      },
      orderStatusHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn().mockImplementation(async (cb) => cb(txMock)),
    };

    const trackingGateway = { emitOrderStatusUpdate: jest.fn() };
    const notificationsService = { notifyOrderCancelled: jest.fn() };
    const webhooksService = { dispatch: jest.fn() };
    const smsService = { sendOrderNotification: jest.fn() };
    const otpService = {};
    const i18n = { t: (key: string) => key };

    const service = new OrdersService(
      db as never,
      otpService as never,
      webhooksService as never,
      trackingGateway as never,
      notificationsService as never,
      smsService as never,
      i18n as never,
    );

    await service.cancel('order-1', 'tenant-1', 'user-1');

    expect(txMock.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({
        status: OrderStatus.CANCELLED,
        otpCode: null,
        otpExpiresAt: null,
      }),
    });
  });
});
