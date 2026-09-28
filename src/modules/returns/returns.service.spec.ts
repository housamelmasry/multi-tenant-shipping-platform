import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { ReturnStatus, OrderStatus, DriverStatus } from '@common/enums';

describe('ReturnsService', () => {
  let service: ReturnsService;
  let db: any;
  let notificationsService: any;
  let webhooksService: any;
  let smsService: any;
  let storageService: any;
  let i18n: any;

  beforeEach(() => {
    db = {
      returnRequest: {
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        create: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      order: {
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      driver: {
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      returnStatusHistory: {
        create: jest.fn(),
      },
      orderStatusHistory: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    notificationsService = { notifyNewReturn: jest.fn() };
    webhooksService = { dispatch: jest.fn() };
    smsService = { sendReturnOtp: jest.fn() };
    storageService = { uploadPhoto: jest.fn() };
    i18n = { t: (key: string) => key };

    service = new ReturnsService(
      db as never,
      webhooksService as never,
      notificationsService as never,
      smsService as never,
      storageService as never,
      i18n as never,
    );
  });

  describe('assignDriver (atomic claim)', () => {
    it('atomically claims driver and pending return using updateMany conditional guards', async () => {
      const mockReturn = {
        id: 'return-1',
        tenantId: 'tenant-1',
        status: ReturnStatus.PENDING,
        orderId: 'order-1',
        warehouseAddress: 'Warehouse A',
      };
      const mockDriver = {
        id: 'driver-1',
        name: 'Driver Ahmed',
        tenantId: 'tenant-1',
        status: DriverStatus.AVAILABLE,
        isActive: true,
      };

      db.returnRequest.findFirst.mockResolvedValue(mockReturn);
      db.driver.findFirst.mockResolvedValue(mockDriver);

      const txMock = {
        driver: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        returnRequest: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          findUniqueOrThrow: jest.fn().mockResolvedValue({
            ...mockReturn,
            driverId: 'driver-1',
            status: ReturnStatus.ASSIGNED,
          }),
        },
        returnStatusHistory: {
          create: jest.fn().mockResolvedValue({}),
        },
      };

      db.$transaction.mockImplementation(async (cb: any) => cb(txMock));

      const result = await service.assignDriver(
        'return-1',
        'tenant-1',
        { driverId: 'driver-1' },
        'user-1',
      );

      expect(txMock.driver.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'driver-1',
          tenantId: 'tenant-1',
          isActive: true,
          status: DriverStatus.AVAILABLE,
        },
        data: { status: DriverStatus.BUSY },
      });

      expect(txMock.returnRequest.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'return-1',
          tenantId: 'tenant-1',
          status: ReturnStatus.PENDING,
          driverId: null,
        },
        data: {
          driverId: 'driver-1',
          status: ReturnStatus.ASSIGNED,
        },
      });

      expect(result).toMatchObject({
        id: 'return-1',
        status: ReturnStatus.ASSIGNED,
        driverId: 'driver-1',
      });
    });

    it('rejects assignment if driver was claimed concurrently (count === 0)', async () => {
      db.returnRequest.findFirst.mockResolvedValue({
        id: 'return-1',
        tenantId: 'tenant-1',
        status: ReturnStatus.PENDING,
      });
      db.driver.findFirst.mockResolvedValue({
        id: 'driver-1',
        status: DriverStatus.AVAILABLE,
      });

      const txMock = {
        driver: {
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      };

      db.$transaction.mockImplementation(async (cb: any) => cb(txMock));

      await expect(
        service.assignDriver('return-1', 'tenant-1', { driverId: 'driver-1' }, 'user-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('restores source order to originalOrderStatus (DELIVERED) and logs history', async () => {
      const mockReturn = {
        id: 'return-1',
        tenantId: 'tenant-1',
        orderId: 'order-1',
        status: ReturnStatus.PENDING,
        originalOrderStatus: OrderStatus.DELIVERED,
      };

      db.returnRequest.findFirst.mockResolvedValue(mockReturn);

      const txMock = {
        returnRequest: {
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        driver: {
          update: jest.fn().mockResolvedValue({}),
        },
        order: {
          update: jest.fn().mockResolvedValue({}),
        },
        orderStatusHistory: {
          create: jest.fn().mockResolvedValue({}),
        },
        returnStatusHistory: {
          create: jest.fn().mockResolvedValue({}),
        },
      };

      db.$transaction.mockImplementation(async (cb: any) => cb(txMock));

      const result = await service.cancel('return-1', 'tenant-1', 'user-1');

      expect(txMock.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: OrderStatus.DELIVERED },
      });

      expect(txMock.orderStatusHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: 'order-1',
          fromStatus: OrderStatus.RETURNED,
          toStatus: OrderStatus.DELIVERED,
        }),
      });

      expect(result).toHaveProperty('message');
    });
  });
});
