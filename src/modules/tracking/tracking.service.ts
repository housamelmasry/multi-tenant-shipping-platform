// src/modules/tracking/tracking.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '@database/database.service';
import { OrderStatus } from '@common/enums';

@Injectable()
export class TrackingService {
  constructor(private db: DatabaseService) {}

  // ─── Public Tracking (العميل النهائي) ─────────────────

  async trackByCode(trackingCode: string) {
    const order = await this.db.order.findUnique({
      where: { trackingCode },
      select: {
        id: true,
        trackingCode: true,
        status: true,
        recipientName: true,
        recipientAddress: true,
        createdAt: true,
        deliveredAt: true,
        driver: {
          select: {
            name: true,
            phone: true,
            vehicleType: true,
            currentLat: true,
            currentLng: true,
            lastLocationAt: true,
          },
        },
        statusHistory: {
          orderBy: { createdAt: 'asc' },
          select: {
            toStatus: true,
            note: true,
            createdAt: true,
          },
        },
      },
    });

    if (!order) throw new NotFoundException('رمز التتبع غير صحيح');

    // نرجع موقع السائق فقط لو الطلب in_transit
    const showDriverLocation = order.status === OrderStatus.IN_TRANSIT;

    return {
      ...order,
      driver: order.driver
        ? {
            name: order.driver.name,
            vehicleType: order.driver.vehicleType,
            // الموقع فقط لو in_transit
            ...(showDriverLocation && {
              currentLat: order.driver.currentLat,
              currentLng: order.driver.currentLng,
              lastLocationAt: order.driver.lastLocationAt,
            }),
          }
        : null,
    };
  }

  // ─── Admin Live Map ────────────────────────────────────

  async getActiveDriversLocations(tenantId: string) {
    return this.db.driver.findMany({
      where: {
        tenantId,
        isActive: true,
        status: { in: ['available', 'busy'] },
        currentLat: { not: null },
        currentLng: { not: null },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        status: true,
        vehicleType: true,
        currentLat: true,
        currentLng: true,
        lastLocationAt: true,
        orders: {
          where: {
            status: { in: ['assigned', 'picked_up', 'in_transit'] },
          },
          select: {
            id: true,
            trackingCode: true,
            status: true,
            recipientAddress: true,
          },
          take: 1,
        },
      },
    });
  }
}
