// src/modules/returns/returns.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseService } from '@database/database.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { AssignReturnDriverDto } from './dto/assign-return-driver.dto';
import { UpdateReturnStatusDto } from './dto/update-return-status.dto';
import { QueryReturnsDto } from './dto/query-returns.dto';
import { WebhooksService } from '@modules/webhooks/webhooks.service';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { SmsService } from '@modules/sms/sms.service';
import { StorageService } from '@modules/storage/storage.service';
import { I18nHelper, withLang } from '@i18n/i18n.utils';
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
    private storageService: StorageService,
    private readonly i18n: I18nHelper,
  ) {}

  // ─── Create Return Request ────────────────────────────

  async create(tenantId: string, dto: CreateReturnDto, userId: string) {
    // Find the original order.
    const order = await this.db.order.findFirst({
      where: { id: dto.orderId, tenantId },
    });

    if (!order) {
      throw new NotFoundException(this.i18n.t('errors.order.not_found'));
    }

    // The order must be in a returnable state.
    const returnableStatuses = [
      OrderStatus.DELIVERED,
      OrderStatus.FAILED,
      OrderStatus.IN_TRANSIT,
    ];

    if (!returnableStatuses.includes(order.status as OrderStatus)) {
      throw new BadRequestException(
        this.i18n.t('errors.return.cannot_create_in_current_status'),
      );
    }

    // Create the return request and update the original order status.
    const returnRequest = await this.db.$transaction(async (tx) => {
      const currentOrder = await tx.order.findFirst({
        where: { id: dto.orderId, tenantId },
        select: { status: true },
      });

      if (
        !currentOrder ||
        !returnableStatuses.includes(currentOrder.status as OrderStatus)
      ) {
        throw new BadRequestException(
          this.i18n.t('errors.return.cannot_create_in_current_status'),
        );
      }

      const transition = await tx.order.updateMany({
        where: {
          id: dto.orderId,
          tenantId,
          status: currentOrder.status,
        },
        data: { status: OrderStatus.RETURNED },
      });

      if (transition.count !== 1) {
        throw new BadRequestException(
          this.i18n.t('errors.return.cannot_create_in_current_status'),
        );
      }

      const newReturn = await tx.returnRequest.create({
        data: {
          orderId: dto.orderId,
          tenantId,
          originalOrderStatus: currentOrder.status,
          reason: dto.reason,
          notes: dto.notes,
          requestedBy: userId,
          warehouseName: dto.warehouse.name,
          warehousePhone: dto.warehouse.phone,
          warehouseAddress: dto.warehouse.address,
          warehouseLat: dto.warehouse.lat,
          warehouseLng: dto.warehouse.lng,
          // Captured now because the warehouse OTP is sent later, from a
          // different request. Explicit `warehouse.lang` wins over the locale.
          warehouseLang: withLang(
            dto.warehouse.lang ?? I18nContext.current()?.lang,
          ),
          status: ReturnStatus.PENDING,
        },
      });

      // Add an entry to the return history.
      await tx.returnStatusHistory.create({
        data: {
          returnRequestId: newReturn.id,
          toStatus: ReturnStatus.PENDING,
          changedByType: 'user',
          changedById: userId,
          note: this.i18n.t('errors.return.history_created'),
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

    if (!returnRequest) {
      throw new NotFoundException(this.i18n.t('errors.return.not_found'));
    }

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
        this.i18n.t('errors.return.cannot_assign_in_current_status'),
      );
    }

    const driver = await this.db.driver.findFirst({
      where: { id: dto.driverId, tenantId, isActive: true },
    });

    if (!driver) {
      throw new NotFoundException(this.i18n.t('errors.driver.not_found'));
    }

    if (driver.status === DriverStatus.BUSY) {
      throw new BadRequestException(this.i18n.t('errors.driver.busy'));
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
      note: this.i18n.t('errors.return.history_driver_assigned', {
        args: { name: driver.name },
      }),
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
      throw new ForbiddenException(
        this.i18n.t('errors.return.not_assigned_to_you'),
      );
    }

    const allowedTransitions = ReturnStatusMeta.allowedTransitions(
      returnRequest.status as ReturnStatus,
    );

    if (!allowedTransitions.includes(dto.status)) {
      throw new BadRequestException(
        this.i18n.t('errors.return.invalid_transition', {
          args: {
            from: this.i18n.t(`errors.return_status.${returnRequest.status}`),
            to: this.i18n.t(`errors.return_status.${dto.status}`),
          },
        }),
      );
    }

    // Require an OTP before marking the return as delivered.
    if (dto.status === ReturnStatus.RETURNED) {
      throw new BadRequestException(
        this.i18n.t('errors.return.otp_required_for_return'),
      );
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
      throw new ForbiddenException(
        this.i18n.t('errors.return.not_assigned_to_you'),
      );
    }

    if (returnRequest.status !== ReturnStatus.IN_TRANSIT) {
      throw new BadRequestException(
        this.i18n.t('errors.return.not_in_transit_to_warehouse'),
      );
    }

    const otpCode = crypto.randomInt(100000, 999999).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.db.returnRequest.update({
      where: { id: returnId },
      data: { otpCode, otpExpiresAt },
    });

    // Send an OTP to the warehouse contact, in the warehouse's language
    // (not the end customer's — see ReturnRequest.warehouseLang).
    const result = await this.smsService.sendReturnOtp({
      phone: returnRequest.warehousePhone,
      orderId: returnRequest.orderId,
      code: otpCode,
      tenantId,
      lang: returnRequest.warehouseLang,
    });

    if (!result.sent) {
      await this.db.returnRequest.updateMany({
        where: { id: returnId, otpCode },
        data: { otpCode: null, otpExpiresAt: null },
      });
      throw new ServiceUnavailableException(
        this.i18n.t('errors.sms.provider_unavailable'),
      );
    }

    return { message: this.i18n.t('errors.return.otp_sent') };
  }

  async verifyWarehouseOtp(
    returnId: string,
    tenantId: string,
    driverId: string,
    code: string,
    productPhoto?: Express.Multer.File,
  ) {
    const returnRequest = await this.db.returnRequest.findFirst({
      where: { id: returnId, tenantId },
      include: { order: true },
    });

    if (!returnRequest) {
      throw new NotFoundException(this.i18n.t('errors.return.not_found'));
    }

    if (returnRequest.driverId !== driverId) {
      throw new ForbiddenException(
        this.i18n.t('errors.return.not_assigned_to_you'),
      );
    }

    if (returnRequest.status !== ReturnStatus.IN_TRANSIT) {
      throw new BadRequestException(
        this.i18n.t('errors.return.not_in_transit_to_warehouse'),
      );
    }

    if (!returnRequest.otpCode || !returnRequest.otpExpiresAt) {
      throw new BadRequestException(this.i18n.t('errors.return.otp_required'));
    }

    if (new Date() > returnRequest.otpExpiresAt) {
      throw new BadRequestException(this.i18n.t('errors.return.otp_expired'));
    }

    if (returnRequest.otpCode !== code) {
      throw new BadRequestException(this.i18n.t('errors.return.otp_invalid'));
    }

    let productPhotoUrl: string | undefined;
    let productPhotoKey: string | undefined;
    if (productPhoto) {
      const uploaded = await this.storageService.uploadPhoto(
        productPhoto,
        'return-photos',
        tenantId,
        { returnId, driverId, type: 'return-proof' },
      );
      productPhotoUrl = uploaded.url;
      productPhotoKey = uploaded.key;
    }

    // ✅ Complete the return.
    const updatedReturn = await this.db.$transaction(async (tx) => {
      const result = await tx.returnRequest.updateMany({
        where: {
          id: returnId,
          tenantId,
          driverId,
          status: ReturnStatus.IN_TRANSIT,
          otpCode: code,
          otpExpiresAt: { gt: new Date() },
        },
        data: {
          status: ReturnStatus.RETURNED,
          otpCode: null,
          otpExpiresAt: null,
          otpVerifiedAt: new Date(),
          returnedAt: new Date(),
          productPhoto: productPhotoUrl,
          productPhotoKey,
        },
      });

      if (result.count !== 1) {
        throw new BadRequestException(
          this.i18n.t('errors.return.not_in_transit_to_warehouse'),
        );
      }

      const updated = await tx.returnRequest.findUniqueOrThrow({
        where: { id: returnId },
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
          note: this.i18n.t('errors.return.history_returned'),
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

    return { message: this.i18n.t('errors.return.completed_successfully') };
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
      throw new BadRequestException(
        this.i18n.t('errors.return.cannot_cancel_in_current_status'),
      );
    }

    await this.db.$transaction(async (tx) => {
      const result = await tx.returnRequest.updateMany({
        where: {
          id: returnId,
          tenantId,
          status: { in: cancellableStatuses },
        },
        data: { status: ReturnStatus.CANCELLED },
      });

      if (result.count !== 1) {
        throw new BadRequestException(
          this.i18n.t('errors.return.cannot_cancel_in_current_status'),
        );
      }

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
        data: {
          status:
            (returnRequest.originalOrderStatus as OrderStatus | null) ??
            OrderStatus.FAILED,
        },
      });

      await tx.returnStatusHistory.create({
        data: {
          returnRequestId: returnId,
          fromStatus: returnRequest.status,
          toStatus: ReturnStatus.CANCELLED,
          changedByType: 'user',
          changedById: userId,
        },
      });
    });

    return { message: this.i18n.t('errors.return.cancelled') };
  }

  // ─── Private ──────────────────────────────────────────

  private async assertReturnBelongsToTenant(id: string, tenantId: string) {
    const returnRequest = await this.db.returnRequest.findFirst({
      where: { id, tenantId },
    });
    if (!returnRequest) {
      throw new NotFoundException(this.i18n.t('errors.return.not_found'));
    }
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
