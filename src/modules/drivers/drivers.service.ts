// src/modules/drivers/drivers.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { DatabaseService } from '@database/database.service';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { QueryDriversDto } from './dto/query-drivers.dto';
import { DriverStatus, UserRole } from '@common/enums';
import { TrackingGateway } from '@modules/tracking/tracking.gateway';
import { I18nContext } from 'nestjs-i18n';
import { I18nHelper, withLang } from '@i18n/i18n.utils';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class DriversService {
  constructor(
    private db: DatabaseService,
    private trackingGateway: TrackingGateway,
    private readonly i18n: I18nHelper,
  ) {}

  // ─── CRUD ─────────────────────────────────────────────

  async create(tenantId: string, dto: CreateDriverDto) {
    // Check that the phone number is unique.
    const existingDriver = await this.db.driver.findUnique({
      where: { phone: dto.phone },
    });
    if (existingDriver) {
      throw new ConflictException(this.i18n.t('errors.driver.phone_in_use'));
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    // Notifications are pushed asynchronously, so the driver's language has to
    // be captured now; an explicit `lang` in the body wins over the request.
    const lang = withLang(dto.lang ?? I18nContext.current()?.lang);

    // Create the driver and user account in a transaction.
    const driver = await this.db.$transaction(async (tx) => {
      const newDriver = await tx.driver.create({
        data: {
          tenantId,
          name: dto.name,
          phone: dto.phone,
          email: dto.email,
          nationalId: dto.nationalId,
          vehicleType: dto.vehicleType,
          vehiclePlate: dto.vehiclePlate,
          status: DriverStatus.OFFLINE,
          lang,
        },
      });

      // Create the user's account for the app.
      await tx.user.create({
        data: {
          tenantId,
          name: dto.name,
          email: dto.email ?? `driver_${newDriver.id}@internal.com`,
          password: hashedPassword,
          role: UserRole.TENANT_STAFF,
          driverId: newDriver.id, // Link the user account to the driver.
          lang, // Same preference as the driver record.
        },
      });

      return newDriver;
    });

    return driver;
  }

  async findAll(tenantId: string, query: QueryDriversDto) {
    const { status, vehicleType, search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      isActive: true,
      ...(status && { status }),
      ...(vehicleType && { vehicleType }),
      ...(search && {
        OR: [{ name: { contains: search } }, { phone: { contains: search } }],
      }),
    };

    const [drivers, total] = await Promise.all([
      this.db.driver.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          phone: true,
          vehicleType: true,
          vehiclePlate: true,
          status: true,
          currentLat: true,
          currentLng: true,
          lastLocationAt: true,
          _count: {
            select: { orders: true },
          },
        },
      }),
      this.db.driver.count({ where }),
    ]);

    return {
      data: drivers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, tenantId: string) {
    const driver = await this.db.driver.findFirst({
      where: { id, tenantId },
      include: {
        orders: {
          where: {
            status: { in: ['assigned', 'picked_up', 'in_transit'] },
          },
          select: {
            id: true,
            trackingCode: true,
            status: true,
            recipientName: true,
            recipientAddress: true,
          },
        },
        _count: {
          select: { orders: true },
        },
      },
    });

    if (!driver) {
      throw new NotFoundException(this.i18n.t('errors.driver.not_found'));
    }
    return driver;
  }

  async update(id: string, tenantId: string, dto: UpdateDriverDto) {
    await this.assertDriverBelongsToTenant(id, tenantId);

    return this.db.driver.update({
      where: { id },
      data: dto,
    });
  }

  async toggleStatus(id: string, tenantId: string) {
    const driver = await this.assertDriverBelongsToTenant(id, tenantId);

    return this.db.driver.update({
      where: { id },
      data: { isActive: !driver.isActive },
      select: { id: true, isActive: true },
    });
  }

  // ─── Location ─────────────────────────────────────────

  async updateLocation(driverId: string, dto: UpdateLocationDto) {
    if (!driverId) {
      throw new NotFoundException(this.i18n.t('errors.driver.not_found'));
    }

    const driver = await this.db.driver.update({
      where: { id: driverId },
      data: {
        currentLat: dto.lat,
        currentLng: dto.lng,
        lastLocationAt: new Date(),
      },
    });

    this.trackingGateway.emitDriverLocationUpdate(driver.tenantId!, {
      id: driver.id,
      name: driver.name,
      status: driver.status,
      currentLat: dto.lat,
      currentLng: dto.lng,
      lastLocationAt: new Date(),
    });

    return driver;
  }

  async updateOnlineStatus(driverId: string, isOnline: boolean) {
    if (!driverId) {
      throw new NotFoundException(this.i18n.t('errors.driver.not_found'));
    }

    const driver = await this.db.driver.findUnique({
      where: { id: driverId },
    });

    if (!driver) {
      throw new NotFoundException(this.i18n.t('errors.driver.not_found'));
    }

    // A busy driver cannot be switched to offline.
    if (driver.status === DriverStatus.BUSY && !isOnline) {
      return {
        message: this.i18n.t('errors.driver.status_change_during_delivery'),
      };
    }

    return this.db.driver.update({
      where: { id: driverId },
      data: {
        status: isOnline ? DriverStatus.AVAILABLE : DriverStatus.OFFLINE,
      },
      select: { id: true, status: true },
    });
  }

  // ─── Driver Stats ─────────────────────────────────────

  async getMyStats(driverId: string) {
    if (!driverId) {
      throw new NotFoundException(this.i18n.t('errors.driver.not_found'));
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalDelivered, todayDelivered, totalFailed, activeOrder] =
      await Promise.all([
        this.db.order.count({
          where: { driverId, status: 'delivered' },
        }),
        this.db.order.count({
          where: {
            driverId,
            status: 'delivered',
            deliveredAt: { gte: today },
          },
        }),
        this.db.order.count({
          where: { driverId, status: 'failed' },
        }),
        this.db.order.findFirst({
          where: {
            driverId,
            status: { in: ['assigned', 'picked_up', 'in_transit'] },
          },
          select: {
            id: true,
            trackingCode: true,
            status: true,
            recipientName: true,
            recipientAddress: true,
            recipientLat: true,
            recipientLng: true,
            recipientPhone: true,
          },
        }),
      ]);

    return {
      totalDelivered,
      todayDelivered,
      totalFailed,
      successRate:
        totalDelivered + totalFailed > 0
          ? Math.round((totalDelivered / (totalDelivered + totalFailed)) * 100)
          : 0,
      activeOrder,
    };
  }

  // ─── Private ──────────────────────────────────────────

  async registerDevice(driverId: string, dto: { fcmToken: string }) {
    if (!driverId) {
      throw new NotFoundException(this.i18n.t('errors.driver.not_found'));
    }

    return this.db.driver.update({
      where: { id: driverId },
      data: { fcmToken: dto.fcmToken, fcmTokenAt: new Date() },
      select: { id: true, fcmToken: true, fcmTokenAt: true },
    });
  }

  private async assertDriverBelongsToTenant(id: string, tenantId: string) {
    const driver = await this.db.driver.findFirst({
      where: { id, tenantId },
    });
    if (!driver) {
      throw new NotFoundException(this.i18n.t('errors.driver.not_found'));
    }
    return driver;
  }
}
