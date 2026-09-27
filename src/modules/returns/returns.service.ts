// src/modules/returns/returns.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DatabaseService } from '@database/database.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { AssignReturnDriverDto } from './dto/assign-return-driver.dto';
import { UpdateReturnStatusDto } from './dto/update-return-status.dto';
import { QueryReturnsDto } from './dto/query-returns.dto';
import { WebhooksService } from '@modules/webhooks/webhooks.service';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { SmsService } from '@modules/sms/sms.service';
import { I18nContext } from 'nestjs-i18n';
import {
  ReturnStatus,
  ReturnStatusMeta,
  OrderStatus,
  DriverStatus,
} from '@common/enums';
import * as crypto from 'crypto';

@Injectable()
export class ReturnsService {
  constructor(
    private db: DatabaseService,
    private webhooksService: WebhooksService,
    private notificationsService: NotificationsService,
    private smsService: SmsService,
  ) {}

  // ─── Create Return Request ────────────────────────────

  async create(tenantId: string, dto: CreateReturnDto, userId: string) {
    // Find the original order.
    const order = await this.db.order.findFirst({
      where: { id: dto.orderId, tenantId },
    });

    if (!order) throw new NotFoundException('الطلب غير موجود');

    // The order must be in a returnable state.
    const returnableStatuses = [
      OrderStatus.DELIVERED,
      OrderStatus.FAILED,
      OrderStatus.IN_TRANSIT,
    ];

    if (!returnableStatuses.includes(order.status as OrderStatus)) {
      throw new BadRequestException(
        'لا يمكن إنشاء طلب إرجاع لهذا الطلب في حالته الحالية',
      );
    }

    // Check that no open return request already exists.
    const existingReturn = await this.db.returnRequest.findFirst({
      where: {
        orderId: dto.orderId,
        status: { notIn: ['cancelled', 'returned'] },
      },
    });

    if (existingReturn) {
      throw new BadRequestException('يوجد طلب إرجاع مفتوح لهذه الشحنة بالفعل');
    }

    // Create the return request and update the original order status.
    const returnRequest = await this.db.$transaction(async (tx) => {
      const newReturn = await tx.returnRequest.create({
        data: {
          orderId: dto.orderId,
          tenantId,
          reason: dto.reason,
          notes: dto.notes,
          requestedBy: userId,
          warehouseName: dto.warehouse.name,
          warehousePhone: dto.warehouse.phone,
          warehouseAddress: dto.warehouse.address,
          warehouseLat: dto.warehouse.lat,
          warehouseLng: dto.warehouse.lng,
          status: ReturnStatus.PENDING,
        },
      });

      // Update the original order status.
      await tx.order.update({
        where: { id: dto.orderId },
        data: { status: OrderStatus.RETURNED },
      });

      // Add an entry to the return history.
      await tx.returnStatusHistory.create({
        data: {
          returnRequestId: newReturn.id,
          toStatus: ReturnStatus.PENDING,
          changedByType: 'user',
          changedById: userId,
          note: 'تم إنشاء طلب الإرجاع',
        },
      });

      return newReturn;
    });

    // Notify the company through a webhook.
    await this.webhooksService.dispatch(tenantId, 'order.returned' as any, {
      ...order,
      returnRequest,
    });

    return returnRequest;
  }

  // ─── Read ─────────────────────────────────────────────

  async findAll(tenantId: string, query: QueryReturnsDto) {
    const { status, reason, search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(status && { status }),
      ...(reason && { reason }),
      ...(search && {
        OR: [
          { order: { trackingCode: { contains: search } } },
          { warehouseName: { contains: search } },
        ],
      }),
    };

    const [returns, total] = await Promise.all([
      this.db.returnRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          reason: true,
          status: true,
          warehouseName: true,
          createdAt: true,
          returnedAt: true,
          order: {
            select: {
              trackingCode: true,
              recipientName: true,
              recipientPhone: true,
            },
          },
          driver: {
            select: { id: true, name: true, phone: true },
          },
        },
      }),
      this.db.returnRequest.count({ where }),
    ]);

    return {
      data: returns,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, tenantId: string) {
    const returnRequest = await this.db.returnRequest.findFirst({
      where: { id, tenantId },
      include: {
        order: {
          select: {
            trackingCode: true,
            recipientName: true,
            recipientPhone: true,
            recipientAddress: true,
            senderName: true,
            codAmount: true,
          },
        },
        driver: {
          select: { id: true, name: true, phone: true, vehicleType: true },
        },
        statusHistory: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!returnRequest) throw new NotFoundException('طلب الإرجاع غير موجود');

    const { otpCode, otpExpiresAt, ...safeReturn } = returnRequest;
    return safeReturn;
  }

  // ─── Assign Driver ────────────────────────────────────

  async assignDriver(
    returnId: string,
    tenantId: string,
    dto: AssignReturnDriverDto,
    userId: string,
  ) {
    const returnRequest = await this.assertReturnBelongsToTenant(
      returnId,
      tenantId,
    );

    if (returnRequest.status !== ReturnStatus.PENDING) {
      throw new BadRequestException(
        'لا يمكن تعيين سائق لهذا الطلب في حالته الحالية',
      );
    }

    const driver = await this.db.driver.findFirst({
      where: { id: dto.driverId, tenantId, isActive: true },
    });

    if (!driver) throw new NotFoundException('السائق غير موجود');

    if (driver.status === DriverStatus.BUSY) {
      throw new BadRequestException('السائق مشغول حالياً');
    }

    const [updatedReturn] = await this.db.$transaction([
      this.db.returnRequest.update({
        where: { id: returnId },
        data: { driverId: dto.driverId, status: ReturnStatus.ASSIGNED },
      }),
      this.db.driver.update({
        where: { id: dto.driverId },
        data: { status: DriverStatus.BUSY },
      }),
    ]);

    await this.logStatusChange({
      returnRequestId: returnId,
      fromStatus: ReturnStatus.PENDING,
      toStatus: ReturnStatus.ASSIGNED,
      changedByType: 'user',
      changedById: userId,
      note: `تم تعيين السائق ${driver.name}`,
    });

    await this.notificationsService.notifyNewReturn(dto.driverId, tenantId, {
      id: returnRequest.id,
      orderId: returnRequest.orderId,
      warehouseAddress: returnRequest.warehouseAddress,
    });

    return updatedReturn;
  }

  // ─── Update Status (Driver) ───────────────────────────

  async updateStatus(
    returnId: string,
    tenantId: string,
    dto: UpdateReturnStatusDto,
    driverId: string,
  ) {
    const returnRequest = await this.assertReturnBelongsToTenant(
      returnId,
      tenantId,
    );

    if (returnRequest.driverId !== driverId) {
      throw new ForbiddenException('هذا الطلب غير مخصص لك');
    }

    const allowedTransitions = ReturnStatusMeta.allowedTransitions(
      returnRequest.status as ReturnStatus,
    );

    if (!allowedTransitions.includes(dto.status)) {
      const i18n = I18nContext.current();
      const from =
        i18n?.t(`errors.return.status.${returnRequest.status}`) ??
        returnRequest.status;
      const to =
        i18n?.t(`errors.return.status.${dto.status}`) ?? dto.status;

      throw new BadRequestException(
        i18n?.t('errors.return.invalid_transition', { args: { from, to } }) ??
          `Cannot transition from ${from} to ${to}`,
      );
    }

    // Require an OTP before marking the return as delivered.
    if (dto.status === ReturnStatus.RETURNED) {
      throw new BadRequestException('يجب التحقق من OTP أولاً لإتمام الإرجاع');
    }

    const updatedReturn = await this.db.returnRequest.update({
      where: { id: returnId },
      data: { status: dto.status },
    });

    await this.logStatusChange({
      returnRequestId: returnId,
      fromStatus: returnRequest.status as ReturnStatus,
      toStatus: dto.status,
      changedByType: 'driver',
      changedById: driverId,
      note: dto.note,
    });

    return updatedReturn;
  }

  // ─── Warehouse OTP ────────────────────────────────────

  async generateWarehouseOtp(
    returnId: string,
    tenantId: string,
    driverId: string,
  ) {
    const returnRequest = await this.assertReturnBelongsToTenant(
      returnId,
      tenantId,
    );

    if (returnRequest.driverId !== driverId) {
      throw new ForbiddenException('هذا الطلب غير مخصص لك');
    }

    if (returnRequest.status !== ReturnStatus.IN_TRANSIT) {
      throw new BadRequestException('الطلب ليس في طريقه للمستودع');
    }

    const otpCode = crypto.randomInt(100000, 999999).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.db.returnRequest.update({
      where: { id: returnId },
      data: { otpCode, otpExpiresAt },
    });

    // Send an OTP to the warehouse contact.
    await this.smsService.sendReturnOtp({
      phone: returnRequest.warehousePhone,
      orderId: returnRequest.orderId,
      code: otpCode,
      tenantId,
    });

    return { message: 'تم إرسال رمز التحقق لموظف المستودع' };
  }

  async verifyWarehouseOtp(
    returnId: string,
    tenantId: string,
    driverId: string,
    code: string,
    productPhoto?: string,
  ) {
    const returnRequest = await this.db.returnRequest.findFirst({
      where: { id: returnId, tenantId },
      include: { order: true },
    });

    if (!returnRequest) throw new NotFoundException('طلب الإرجاع غير موجود');

    if (returnRequest.driverId !== driverId) {
      throw new ForbiddenException('هذا الطلب غير مخصص لك');
    }

    if (!returnRequest.otpCode || !returnRequest.otpExpiresAt) {
      throw new BadRequestException('يجب طلب رمز التحقق أولاً');
    }

    if (new Date() > returnRequest.otpExpiresAt) {
      throw new BadRequestException('انتهت صلاحية رمز التحقق');
    }

    if (returnRequest.otpCode !== code) {
      throw new BadRequestException('رمز التحقق غير صحيح');
    }

    // ✅ Complete the return.
    const updatedReturn = await this.db.$transaction(async (tx) => {
      const updated = await tx.returnRequest.update({
        where: { id: returnId },
        data: {
          status: ReturnStatus.RETURNED,
          otpCode: null,
          otpExpiresAt: null,
          otpVerifiedAt: new Date(),
          returnedAt: new Date(),
          productPhoto,
        },
      });

      // Release the driver.
      await tx.driver.update({
        where: { id: driverId },
        data: { status: DriverStatus.AVAILABLE },
      });

      await tx.returnStatusHistory.create({
        data: {
          returnRequestId: returnId,
          fromStatus: ReturnStatus.IN_TRANSIT,
          toStatus: ReturnStatus.RETURNED,
          changedByType: 'driver',
          changedById: driverId,
          note: 'تم الإرجاع للمستودع بنجاح مع التحقق من OTP',
        },
      });

      return updated;
    });

    // Notify the company.
    await this.webhooksService.dispatch(
      tenantId,
      'order.returned' as any,
      updatedReturn,
    );

    return { message: 'تم الإرجاع للمستودع بنجاح ✅' };
  }

  // ─── Cancel ───────────────────────────────────────────

  async cancel(returnId: string, tenantId: string, userId: string) {
    const returnRequest = await this.assertReturnBelongsToTenant(
      returnId,
      tenantId,
    );

    const cancellableStatuses = [ReturnStatus.PENDING, ReturnStatus.ASSIGNED];
    if (
      !(cancellableStatuses as ReturnStatus[]).includes(
        returnRequest.status as ReturnStatus,
      )
    ) {
      throw new BadRequestException('لا يمكن إلغاء هذا الطلب في حالته الحالية');
    }

    await this.db.$transaction(async (tx) => {
      await tx.returnRequest.update({
        where: { id: returnId },
        data: { status: ReturnStatus.CANCELLED },
      });

      // Release the assigned driver, if any.
      if (returnRequest.driverId) {
        await tx.driver.update({
          where: { id: returnRequest.driverId },
          data: { status: DriverStatus.AVAILABLE },
        });
      }

      // Restore the original order to its previous status.
      await tx.order.update({
        where: { id: returnRequest.orderId },
        data: { status: OrderStatus.FAILED },
      });
    });

    await this.logStatusChange({
      returnRequestId: returnId,
      fromStatus: returnRequest.status as ReturnStatus,
      toStatus: ReturnStatus.CANCELLED,
      changedByType: 'user',
      changedById: userId,
    });

    return { message: 'تم إلغاء طلب الإرجاع' };
  }

  // ─── Private ──────────────────────────────────────────

  private async assertReturnBelongsToTenant(id: string, tenantId: string) {
    const returnRequest = await this.db.returnRequest.findFirst({
      where: { id, tenantId },
    });
    if (!returnRequest) throw new NotFoundException('طلب الإرجاع غير موجود');
    return returnRequest;
  }

  private async logStatusChange(data: {
    returnRequestId: string;
    fromStatus?: ReturnStatus;
    toStatus: ReturnStatus;
    changedByType: 'system' | 'user' | 'driver';
    changedById?: string;
    note?: string;
  }) {
    await this.db.returnStatusHistory.create({
      data: {
        returnRequestId: data.returnRequestId,
        fromStatus: data.fromStatus,
        toStatus: data.toStatus,
        changedByType: data.changedByType,
        changedById: data.changedById,
        note: data.note,
      },
    });
  }
}
