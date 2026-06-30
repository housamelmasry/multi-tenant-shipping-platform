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
import * as bcrypt from 'bcryptjs';

@Injectable()
export class DriversService {
  constructor(
    private db: DatabaseService,
    private trackingGateway: TrackingGateway,
  ) {}

  // ─── CRUD ─────────────────────────────────────────────

  async create(tenantId: string, dto: CreateDriverDto) {
    // التحقق من عدم تكرار الهاتف
    const existingDriver = await this.db.driver.findUnique({
      where: { phone: dto.phone },
    });
    if (existingDriver) {
      throw new ConflictException('رقم الهاتف مستخدم بالفعل');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    // إنشاء الـ driver + user account في transaction
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
        },
      });

      // user account للتطبيق
      await tx.user.create({
        data: {
          tenantId,
          name: dto.name,
          email: dto.email ?? `driver_${newDriver.id}@internal.com`,
          password: hashedPassword,
          role: UserRole.TENANT_STAFF,
          driverId: newDriver.id, // ربط الـ user بالـ driver
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

    if (!driver) throw new NotFoundException('السائق غير موجود');
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
    const driver = await this.db.driver.findUnique({
      where: { id: driverId },
    });

    if (!driver) throw new NotFoundException('السائق غير موجود');

    // لو مشغول مينفعش يتحول لـ offline
    if (driver.status === DriverStatus.BUSY && !isOnline) {
      return { message: 'لا يمكن تغيير الحالة أثناء التوصيل' };
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

  private async assertDriverBelongsToTenant(id: string, tenantId: string) {
    const driver = await this.db.driver.findFirst({
      where: { id, tenantId },
    });
    if (!driver) throw new NotFoundException('السائق غير موجود');
    return driver;
  }
}
