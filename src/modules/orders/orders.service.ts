// src/modules/orders/orders.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '@database/database.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { QueryOrdersDto } from './dto/query-orders.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { AssignDriverDto } from './dto/assign-driver.dto';
import { OrderStatus, OrderStatusMeta, DriverStatus } from '@common/enums';
import { OrdersOtpService } from './orders-otp.service';
import { WebhooksService } from '@modules/webhooks/webhooks.service';
import * as crypto from 'crypto';

@Injectable()
export class OrdersService {
  constructor(
    private db: DatabaseService,
    private otpService: OrdersOtpService,
    private webhooksService: WebhooksService,
  ) {}

  // ─── Create ──────────────────────────────────────────

  async create(tenantId: string, dto: CreateOrderDto) {
    const trackingCode = this.generateTrackingCode();

    const order = await this.db.order.create({
      data: {
        tenantId,
        trackingCode,
        externalRef: dto.externalRef,

        senderName: dto.sender.name,
        senderPhone: dto.sender.phone,
        senderAddress: dto.sender.address,
        senderLat: dto.sender.lat,
        senderLng: dto.sender.lng,

        recipientName: dto.recipient.name,
        recipientPhone: dto.recipient.phone,
        recipientAddress: dto.recipient.address,
        recipientLat: dto.recipient.lat,
        recipientLng: dto.recipient.lng,

        description: dto.description,
        weight: dto.weight,
        codAmount: dto.codAmount ?? 0,
        notes: dto.notes,
        status: OrderStatus.PENDING,
      },
    });

    // تسجيل أول حالة في التاريخ
    await this.logStatusChange({
      orderId: order.id,
      toStatus: OrderStatus.PENDING,
      changedByType: 'system',
    });

    return order;
  }

  // ─── Read ─────────────────────────────────────────────

  async findAll(tenantId: string, query: QueryOrdersDto) {
    const { status, search, driverId, dateFrom, dateTo, page, limit } = query;
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(status && { status }),
      ...(driverId && { driverId }),
      ...(search && {
        OR: [
          { trackingCode: { contains: search } },
          { externalRef: { contains: search } },
          { recipientName: { contains: search } },
          { recipientPhone: { contains: search } },
        ],
      }),
      ...((dateFrom || dateTo) && {
        createdAt: {
          ...(dateFrom && { gte: new Date(dateFrom) }),
          ...(dateTo && { lte: new Date(dateTo) }),
        },
      }),
    };

    const [orders, total] = await Promise.all([
      this.db.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          trackingCode: true,
          externalRef: true,
          status: true,
          recipientName: true,
          recipientPhone: true,
          recipientAddress: true,
          codAmount: true,
          createdAt: true,
          deliveredAt: true,
          driver: {
            select: { id: true, name: true, phone: true },
          },
        },
      }),
      this.db.order.count({ where }),
    ]);

    return {
      data: orders,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, tenantId: string) {
    const order = await this.db.order.findFirst({
      where: { id, tenantId },
      include: {
        driver: {
          select: { id: true, name: true, phone: true, vehicleType: true },
        },
        statusHistory: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!order) throw new NotFoundException('الطلب غير موجود');

    // مش نرجع الـ OTP أبداً
    const { otpCode, otpExpiresAt, ...safeOrder } = order;
    return safeOrder;
  }

  // ─── Assign Driver ────────────────────────────────────

  async assignDriver(
    orderId: string,
    tenantId: string,
    dto: AssignDriverDto,
    userId: string,
  ) {
    const order = await this.assertOrderBelongsToTenant(orderId, tenantId);

    // الطلب لازم يكون pending
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        'لا يمكن تعيين سائق لهذا الطلب في حالته الحالية',
      );
    }

    // التحقق إن السائق ينتمي لنفس الـ tenant
    const driver = await this.db.driver.findFirst({
      where: { id: dto.driverId, tenantId, isActive: true },
    });

    if (!driver) throw new NotFoundException('السائق غير موجود');

    if (driver.status === DriverStatus.BUSY) {
      throw new BadRequestException('السائق مشغول حالياً');
    }

    // Transaction: تعيين السائق + تحديث حالته
    const [updatedOrder] = await this.db.$transaction([
      this.db.order.update({
        where: { id: orderId },
        data: {
          driverId: dto.driverId,
          status: OrderStatus.ASSIGNED,
        },
      }),
      this.db.driver.update({
        where: { id: dto.driverId },
        data: { status: DriverStatus.BUSY },
      }),
    ]);

    await this.logStatusChange({
      orderId,
      fromStatus: OrderStatus.PENDING,
      toStatus: OrderStatus.ASSIGNED,
      changedByType: 'user',
      changedById: userId,
      note: `تم تعيين السائق ${driver.name}`,
    });

    // إشعار الـ webhook
    await this.webhooksService.dispatch(
      tenantId,
      'order.assigned',
      updatedOrder,
    );

    return updatedOrder;
  }

  // ─── Update Status (Driver) ───────────────────────────

  async updateStatus(
    orderId: string,
    tenantId: string,
    dto: UpdateOrderStatusDto,
    driverId: string,
  ) {
    const order = await this.assertOrderBelongsToTenant(orderId, tenantId);

    // التحقق إن السائق هو المعين على الطلب
    if (order.driverId !== driverId) {
      throw new ForbiddenException('هذا الطلب غير مخصص لك');
    }

    // التحقق من صحة الانتقال
    const allowedTransitions = OrderStatusMeta.allowedTransitions(
      order.status as OrderStatus,
    );

    if (!allowedTransitions.includes(dto.status)) {
      throw new BadRequestException(
        `لا يمكن الانتقال من ${OrderStatusMeta.label(order.status as OrderStatus)} إلى ${OrderStatusMeta.label(dto.status)}`,
      );
    }

    // لو الحالة delivered → لازم OTP أولاً
    if (dto.status === OrderStatus.DELIVERED) {
      throw new BadRequestException('يجب التحقق من OTP أولاً لإتمام التسليم');
    }

    const updateData: any = {
      status: dto.status,
      ...(dto.status === OrderStatus.PICKED_UP && { pickedUpAt: new Date() }),
      ...(dto.status === OrderStatus.FAILED && {
        failedReason: dto.failedReason,
      }),
    };

    // لو الطلب انتهى → حرر السائق
    if (OrderStatusMeta.isFinal(dto.status)) {
      updateData.driver = {
        update: { status: DriverStatus.AVAILABLE },
      };
    }

    const updatedOrder = await this.db.order.update({
      where: { id: orderId },
      data: updateData,
    });

    await this.logStatusChange({
      orderId,
      fromStatus: order.status as OrderStatus,
      toStatus: dto.status,
      changedByType: 'driver',
      changedById: driverId,
      note: dto.note,
    });

    await this.webhooksService.dispatch(
      tenantId,
      `order.${dto.status}`,
      updatedOrder,
    );

    return updatedOrder;
  }

  // ─── Cancel ───────────────────────────────────────────

  async cancel(orderId: string, tenantId: string, userId: string) {
    const order = await this.assertOrderBelongsToTenant(orderId, tenantId);

    const cancellableStatuses = [OrderStatus.PENDING, OrderStatus.ASSIGNED];
    if (!cancellableStatuses.includes(order.status as OrderStatus)) {
      throw new BadRequestException('لا يمكن إلغاء هذا الطلب في حالته الحالية');
    }

    const updatedOrder = await this.db.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED },
      });

      // تحرير السائق لو كان معين
      if (order.driverId) {
        await tx.driver.update({
          where: { id: order.driverId },
          data: { status: DriverStatus.AVAILABLE },
        });
      }

      return updated;
    });

    await this.logStatusChange({
      orderId,
      fromStatus: order.status as OrderStatus,
      toStatus: OrderStatus.CANCELLED,
      changedByType: 'user',
      changedById: userId,
    });

    await this.webhooksService.dispatch(
      tenantId,
      'order.cancelled',
      updatedOrder,
    );

    return updatedOrder;
  }

  // ─── Private Helpers ──────────────────────────────────

  async assertOrderBelongsToTenant(orderId: string, tenantId: string) {
    const order = await this.db.order.findFirst({
      where: { id: orderId, tenantId },
    });
    if (!order) throw new NotFoundException('الطلب غير موجود');
    return order;
  }

  private async logStatusChange(data: {
    orderId: string;
    fromStatus?: OrderStatus;
    toStatus: OrderStatus;
    changedByType: 'system' | 'user' | 'driver';
    changedById?: string;
    note?: string;
  }) {
    await this.db.orderStatusHistory.create({
      data: {
        orderId: data.orderId,
        fromStatus: data.fromStatus,
        toStatus: data.toStatus,
        changedByType: data.changedByType,
        changedById: data.changedById,
        note: data.note,
      },
    });
  }

  private generateTrackingCode(): string {
    const prefix = 'SHP';
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${prefix}-${random}`;
    // مثال: SHP-A3F92B1C
  }
}
