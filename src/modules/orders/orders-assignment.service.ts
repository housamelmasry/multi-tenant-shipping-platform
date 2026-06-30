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

@Injectable()
export class OrdersAssignmentService {
  constructor(
    private db: DatabaseService,
    private webhooksService: WebhooksService,
    private trackingGateway: TrackingGateway,
    private notificationsService: NotificationsService,
  ) {}

  async autoAssign(orderId: string, tenantId: string) {
    const order = await this.db.order.findFirst({
      where: { id: orderId, tenantId },
    });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('يمكن تعيين الطلبات المعلقة فقط');
    }
    if (!order.senderLat || !order.senderLng) {
      throw new BadRequestException('الطلب لا يحتوي على إحداثيات المرسل');
    }

    const config = await this.getTenantAssignmentConfig(tenantId);
    const driver = await this.findNearestDriver(
      tenantId,
      Number(order.senderLat),
      Number(order.senderLng),
      config.maxDistanceKm,
    );
    if (!driver) {
      throw new BadRequestException('لا يوجد سائق متاح قريب');
    }

    const [updatedOrder] = await this.db.$transaction([
      this.db.order.update({
        where: { id: orderId },
        data: { driverId: driver.id, status: OrderStatus.ASSIGNED },
      }),
      this.db.driver.update({
        where: { id: driver.id },
        data: { status: DriverStatus.BUSY },
      }),
    ]);

    await this.db.orderStatusHistory.create({
      data: {
        orderId,
        fromStatus: OrderStatus.PENDING,
        toStatus: OrderStatus.ASSIGNED,
        changedByType: 'system',
        note: `تعيين تلقائي: ${driver.name} (${driver.distanceKm} كم)`,
      },
    });

    await this.webhooksService.dispatch(tenantId, 'order.assigned', updatedOrder);
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
    });

    const results = { assigned: 0, skipped: 0, errors: [] as string[] };

    for (const order of pendingOrders) {
      try {
        await this.autoAssign(order.id, tenantId);
        results.assigned++;
      } catch (e: any) {
        results.skipped++;
        results.errors.push(`الطلب ${order.trackingCode}: ${e.message}`);
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
    if (!order) throw new NotFoundException('الطلب غير موجود');

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
        ? { name: nearestDrivers[0].name, distanceKm: nearestDrivers[0].distanceKm }
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
  ) {
    const drivers = await this.getNearestDrivers(tenantId, lat, lng, maxDistanceKm);
    return drivers[0] ?? null;
  }

  private async getNearestDrivers(
    tenantId: string,
    lat: number,
    lng: number,
    maxDistanceKm: number,
  ) {
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);

    const drivers = await this.db.driver.findMany({
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
    });

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
