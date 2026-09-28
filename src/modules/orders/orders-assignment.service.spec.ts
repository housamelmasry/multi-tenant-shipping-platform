import { OrdersAssignmentService } from './orders-assignment.service';
import { DriverStatus, OrderStatus } from '@common/enums';

describe('OrdersAssignmentService atomic claim', () => {
  it('conditionally claims an available driver and a pending unassigned order', async () => {
    const order = {
      id: 'order-1',
      tenantId: 'tenant-1',
      status: OrderStatus.PENDING,
      senderLat: 24.7136,
      senderLng: 46.6753,
      trackingCode: 'TRACK1',
      recipientAddress: 'Destination',
    };
    const driver = {
      id: 'driver-1',
      name: 'Driver One',
      phone: '+966500000001',
      currentLat: 24.7136,
      currentLng: 46.6753,
    };
    const tx = {
      driver: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      order: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...order,
          status: OrderStatus.ASSIGNED,
          driverId: driver.id,
        }),
      },
      orderStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    };
    const db = {
      order: { findFirst: jest.fn().mockResolvedValue(order) },
      $transaction: jest.fn(
        (callback: (transaction: typeof tx) => Promise<unknown>) =>
          callback(tx),
      ),
    };
    const service = new OrdersAssignmentService(
      db as never,
      { dispatch: jest.fn() } as never,
      { emitOrderStatusUpdate: jest.fn() } as never,
      { notifyNewOrder: jest.fn() } as never,
      { t: (key: string) => key } as never,
    );

    await service.autoAssign('order-1', 'tenant-1', [driver], {
      maxDistanceKm: 20,
    });

    expect(tx.driver.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'driver-1',
        tenantId: 'tenant-1',
        isActive: true,
        status: DriverStatus.AVAILABLE,
      },
      data: { status: DriverStatus.BUSY },
    });
    expect(tx.order.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'order-1',
        tenantId: 'tenant-1',
        status: OrderStatus.PENDING,
        driverId: null,
      },
      data: { driverId: 'driver-1', status: OrderStatus.ASSIGNED },
    });
  });
});
