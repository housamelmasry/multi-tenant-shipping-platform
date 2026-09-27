import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '@database/database.service';
import { OrderStatus, DriverStatus } from '@common/enums';
import { WebhooksService } from '@modules/webhooks/webhooks.service';
import { TrackingGateway } from '@modules/tracking/tracking.gateway';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { I18nHelper } from '@i18n/i18n.utils';

type AvailableDriver = {
  id: string;
  name: string;
  phone: string;
  currentLat: number | null;
  currentLng: number | null;
};

type AssignmentConfig = { maxDistanceKm: number };

@Injectable()
export class OrdersAssignmentService {
  constructor(
    private db: DatabaseService,
    private webhooksService: WebhooksService,
    private trackingGateway: TrackingGateway,
    private notificationsService: NotificationsService,
    private readonly i18n: I18nHelper,
  ) {}

  async autoAssign(
    orderId: string,
    tenantId: string,
    availableDrivers?: AvailableDriver[],
    assignmentConfig?: AssignmentConfig,
  ) {
    const order = await this.db.order.findFirst({
      where: { id: orderId, tenantId },
    });
    if (!order) {
      throw new NotFoundException(this.i18n.t('errors.order.not_found'));
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        this.i18n.t('errors.order.only_pending_can_be_assigned'),
      );
    }
    if (order.senderLat == null || order.senderLng == null) {
      throw new BadRequestException(
        this.i18n.t('errors.order.missing_sender_coordinates'),
      );
    }

    const config =
      assignmentConfig ?? (await this.getTenantAssignmentConfig(tenantId));
    const driver = await this.findNearestDriver(
      tenantId,
      Number(order.senderLat),
      Number(order.senderLng),
      config.maxDistanceKm,
      availableDrivers,
    );
    if (!driver) {
      throw new BadRequestException(
        this.i18n.t('errors.order.no_nearby_driver'),
      );
    }

    const updatedOrder = await this.db.$transaction(async (tx) => {
      const claimedDriver = await tx.driver.updateMany({
        where: {
          id: driver.id,
          tenantId,
          isActive: true,
          status: DriverStatus.AVAILABLE,
        },
        data: { status: DriverStatus.BUSY },
      });

      if (claimedDriver.count !== 1) {
        throw new BadRequestException(this.i18n.t('errors.driver.busy'));
      }

      const claimedOrder = await tx.order.updateMany({
        where: {
          id: orderId,
          tenantId,
          status: OrderStatus.PENDING,
          driverId: null,
        },
        data: { driverId: driver.id, status: OrderStatus.ASSIGNED },
      });

      if (claimedOrder.count !== 1) {
        throw new BadRequestException(
          this.i18n.t('errors.order.only_pending_can_be_assigned'),
        );
      }

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: OrderStatus.PENDING,
          toStatus: OrderStatus.ASSIGNED,
          changedByType: 'system',
          note: this.i18n.t('errors.order.history_auto_assigned', {
            args: { name: driver.name, distance: driver.distanceKm },
          }),
        },
      });

      return tx.order.findUniqueOrThrow({ where: { id: orderId } });
    });

    await this.webhooksService.dispatch(
      tenantId,
      'order.assigned',
      updatedOrder,
    );
    this.trackingGateway.emitOrderStatusUpdate(tenantId, {
      id: updatedOrder.id,
      trackingCode: updatedOrder.trackingCode,
      status: updatedOrder.status,
      driverId: driver.id,
    });

    await this.notificationsService.notifyNewOrder(driver.id, tenantId, {
      id: updatedOrder.id,
      trackingCode: updatedOrder.trackingCode,
      recipientAddress: updatedOrder.recipientAddress,
    });

    return {
      order: {
        id: updatedOrder.id,
        trackingCode: updatedOrder.trackingCode,
        status: updatedOrder.status,
      },
      assignedDriver: {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        distanceKm: driver.distanceKm,
      },
    };
  }

  async bulkAutoAssign(tenantId: string) {
    const pendingOrders = await this.db.order.findMany({
      where: { tenantId, status: OrderStatus.PENDING, driverId: null },
      select: {
        id: true,
        trackingCode: true,
        senderLat: true,
        senderLng: true,
      },
    });

    const results = { assigned: 0, skipped: 0, errors: [] as string[] };
    const assignmentConfig = await this.getTenantAssignmentConfig(tenantId);
    let availableDrivers = await this.getAvailableDrivers(tenantId);

    for (const order of pendingOrders) {
      if (order.senderLat == null || order.senderLng == null) {
        results.skipped++;
        results.errors.push(
          this.i18n.t('errors.order.bulk_assign_failed', {
            args: {
              trackingCode: order.trackingCode,
              reason: this.i18n.t('errors.order.missing_sender_coordinates'),
            },
          }),
        );
        continue;
      }

      const selectedDriver = await this.findNearestDriver(
        tenantId,
        Number(order.senderLat),
        Number(order.senderLng),
        assignmentConfig.maxDistanceKm,
        availableDrivers,
      );

      if (!selectedDriver) {
        results.skipped++;
        results.errors.push(
          this.i18n.t('errors.order.bulk_assign_failed', {
            args: {
              trackingCode: order.trackingCode,
              reason: this.i18n.t('errors.order.no_nearby_driver'),
            },
          }),
        );
        continue;
      }

      try {
        await this.autoAssign(
          order.id,
          tenantId,
          availableDrivers,
          assignmentConfig,
        );
        results.assigned++;
        availableDrivers = availableDrivers.filter(
          (driver) => driver.id !== selectedDriver.id,
        );
      } catch (e: any) {
        availableDrivers = availableDrivers.filter(
          (driver) => driver.id !== selectedDriver.id,
        );
        results.skipped++;
        results.errors.push(
          this.i18n.t('errors.order.bulk_assign_failed', {
            args: { trackingCode: order.trackingCode, reason: e.message },
          }),
        );
      }
    }

    return results;
  }

  async previewAssignment(orderId: string, tenantId: string) {
    const order = await this.db.order.findFirst({
      where: { id: orderId, tenantId },
      select: {
        trackingCode: true,
        senderLat: true,
        senderLng: true,
        status: true,
      },
    });
    if (!order) {
      throw new NotFoundException(this.i18n.t('errors.order.not_found'));
    }

    if (order.senderLat == null || order.senderLng == null) {
      throw new BadRequestException(
        this.i18n.t('errors.order.missing_sender_coordinates'),
      );
    }

    const config = await this.getTenantAssignmentConfig(tenantId);
    const nearestDrivers = await this.getNearestDrivers(
      tenantId,
      Number(order.senderLat),
      Number(order.senderLng),
      config.maxDistanceKm,
    );

    return {
      order: {
        trackingCode: order.trackingCode,
        senderLat: order.senderLat,
        senderLng: order.senderLng,
      },
      nearestDrivers: nearestDrivers.map((d) => ({
        name: d.name,
        distanceKm: d.distanceKm,
      })),
      wouldAssignDriver: nearestDrivers[0]
        ? {
            name: nearestDrivers[0].name,
            distanceKm: nearestDrivers[0].distanceKm,
          }
        : null,
      config,
    };
  }

  private async getTenantAssignmentConfig(tenantId: string) {
    const tenant = await this.db.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    const settings = (tenant?.settings as Record<string, any>) ?? {};
    return { maxDistanceKm: settings.maxDistanceKm ?? 20 };
  }

  private async findNearestDriver(
    tenantId: string,
    lat: number,
    lng: number,
    maxDistanceKm: number,
    availableDrivers?: AvailableDriver[],
  ) {
    const drivers = await this.getNearestDrivers(
      tenantId,
      lat,
      lng,
      maxDistanceKm,
      availableDrivers,
    );
    return drivers[0] ?? null;
  }

  private async getNearestDrivers(
    tenantId: string,
    lat: number,
    lng: number,
    maxDistanceKm: number,
    availableDrivers?: AvailableDriver[],
  ) {
    const drivers = availableDrivers ?? (await this.getAvailableDrivers(tenantId));

    const withDistance = drivers
      .map((d) => ({
        ...d,
        distanceKm: this.haversineDistance(
          lat,
          lng,
          Number(d.currentLat!),
          Number(d.currentLng!),
        ),
      }))
      .filter((d) => d.distanceKm <= maxDistanceKm)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    return withDistance;
  }

  private async getAvailableDrivers(tenantId: string): Promise<AvailableDriver[]> {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

    return this.db.driver.findMany({
      where: {
        tenantId,
        isActive: true,
        status: DriverStatus.AVAILABLE,
        currentLat: { not: null },
        currentLng: { not: null },
        lastLocationAt: { gte: thirtyMinAgo },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        currentLat: true,
        currentLng: true,
      },
    }) as Promise<AvailableDriver[]>;
  }

  private haversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 10) / 10;
  }

  private toRad(deg: number): number {
    return (deg * Math.PI) / 180;
  }
}
