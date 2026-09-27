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
import { TrackingGateway } from '@modules/tracking/tracking.gateway';
import { NotificationsService } from '@modules/notifications/notifications.service';
import {
  SmsService,
  orderNotificationTemplate,
} from '@modules/sms/sms.service';
import { I18nContext } from 'nestjs-i18n';
import { I18nHelper, withLang } from '@i18n/i18n.utils';
import * as crypto from 'crypto';

@Injectable()
export class OrdersService {
  constructor(
    private db: DatabaseService,
    private otpService: OrdersOtpService,
    private webhooksService: WebhooksService,
    private trackingGateway: TrackingGateway,
    private notificationsService: NotificationsService,
    private smsService: SmsService,
    private readonly i18n: I18nHelper,
  ) {}

  // ─── Create ──────────────────────────────────────────

  async create(tenantId: string, dto: CreateOrderDto) {
    const trackingCode = this.generateTrackingCode();

    // The recipient's language is fixed now, at creation, because the status
    // SMS that need it are sent long after this request has finished. The
    // creating request's language is the best available guess; an explicit
    // `recipientLang` in the body wins.
    const recipientLang = withLang(
      dto.recipientLang ?? I18nContext.current()?.lang,
    );

    const order = await this.db.order.create({
      data: {
        tenantId,
        trackingCode,
        externalRef: dto.externalRef,
        recipientLang,

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

    // Record the initial status in the history.
    await this.logStatusChange({
      orderId: order.id,
      toStatus: OrderStatus.PENDING,
      changedByType: 'system',
    });

    return order;
  }

  // ─── Read ─────────────────────────────────────────────

  async findAll(tenantId: string, query: QueryOrdersDto) {
    const {
      status,
      search,
      driverId,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = query;
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

    if (!order) {
      throw new NotFoundException(this.i18n.t('errors.order.not_found'));
    }

    // Never return the OTP.
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

    // The order must be pending.
    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException(
        this.i18n.t('errors.order.cannot_assign_in_current_status'),
      );
    }

    // Verify that the driver belongs to the same tenant.
    const driver = await this.db.driver.findFirst({
      where: { id: dto.driverId, tenantId, isActive: true },
    });

    if (!driver) {
      throw new NotFoundException(this.i18n.t('errors.driver.not_found'));
    }

    if (driver.status === DriverStatus.BUSY) {
      throw new BadRequestException(this.i18n.t('errors.driver.busy'));
    }

    // Transaction: assign the driver and update their status.
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
      note: this.i18n.t('errors.order.history_driver_assigned', {
        args: { name: driver.name },
      }),
    });

    // Send the webhook notification.
    await this.webhooksService.dispatch(
      tenantId,
      'order.assigned',
      updatedOrder,
    );

    // Send an SMS notification to the customer.
    await this.smsService.sendOrderNotification({
      phone: order.recipientPhone,
      template: 'order.assigned',
      recipientName: order.recipientName,
      trackingCode: order.trackingCode,
      driverName: driver.name,
      driverPhone: driver.phone,
      lang: order.recipientLang,
      tenantId,
      orderId,
    });

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

    // Verify that this driver is assigned to the order.
    if (order.driverId !== driverId) {
      throw new ForbiddenException(
        this.i18n.t('errors.order.not_assigned_to_you'),
      );
    }

    // Validate the status transition.
    const allowedTransitions = OrderStatusMeta.allowedTransitions(
      order.status as OrderStatus,
    );

    if (!allowedTransitions.includes(dto.status)) {
      throw new BadRequestException(
        this.i18n.t('errors.order.invalid_transition', {
          args: {
            from: this.i18n.t(
              OrderStatusMeta.labelKey(order.status as OrderStatus),
            ),
            to: this.i18n.t(OrderStatusMeta.labelKey(dto.status)),
          },
        }),
      );
    }

    // Require an OTP before marking the order as delivered.
    if (dto.status === OrderStatus.DELIVERED) {
      throw new BadRequestException(
        this.i18n.t('errors.order.otp_required_for_delivery'),
      );
    }

    const updateData: any = {
      status: dto.status,
      ...(dto.status === OrderStatus.PICKED_UP && { pickedUpAt: new Date() }),
      ...(dto.status === OrderStatus.FAILED && {
        failedReason: dto.failedReason,
      }),
    };

    // Release the driver when the order reaches a terminal state.
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
      `order.${dto.status.toLowerCase()}` as any,
      updatedOrder,
    );

    this.trackingGateway.emitOrderStatusUpdate(tenantId, {
      id: updatedOrder.id,
      trackingCode: updatedOrder.trackingCode,
      status: updatedOrder.status,
      driverId: updatedOrder.driverId ?? undefined,
    });

    const template = orderNotificationTemplate(dto.status.toLowerCase());
    if (template) {
      await this.smsService.sendOrderNotification({
        phone: order.recipientPhone,
        template,
        recipientName: order.recipientName,
        trackingCode: order.trackingCode,
        tenantId,
        orderId,
        lang: order.recipientLang,
      });
    }

    return updatedOrder;
  }

  // ─── Cancel ───────────────────────────────────────────

  async cancel(orderId: string, tenantId: string, userId: string) {
    const order = await this.assertOrderBelongsToTenant(orderId, tenantId);

    const cancellableStatuses = [OrderStatus.PENDING, OrderStatus.ASSIGNED];
    if (!cancellableStatuses.includes(order.status as OrderStatus)) {
      throw new BadRequestException(
        this.i18n.t('errors.order.cannot_cancel_in_current_status'),
      );
    }

    const updatedOrder = await this.db.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED },
      });

      // Release the assigned driver, if any.
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

    if (order.driverId) {
      await this.notificationsService.notifyOrderCancelled(
        order.driverId,
        tenantId,
        { id: order.id, trackingCode: updatedOrder.trackingCode },
      );
    }

    return updatedOrder;
  }

  // ─── Public Tracking ──────────────────────────────────

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

    if (!order) {
      throw new NotFoundException(
        this.i18n.t('errors.order.invalid_tracking_code'),
      );
    }
    return order;
  }

  // ─── Private Helpers ──────────────────────────────────

  async assertOrderBelongsToTenant(orderId: string, tenantId: string) {
    const order = await this.db.order.findFirst({
      where: { id: orderId, tenantId },
    });
    if (!order) {
      throw new NotFoundException(this.i18n.t('errors.order.not_found'));
    }
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
    // Example: SHP-A3F92B1C
  }
}
