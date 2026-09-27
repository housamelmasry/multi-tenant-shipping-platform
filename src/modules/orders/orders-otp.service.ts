// src/modules/orders/orders-otp.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '@database/database.service';
import { OrderStatus, DriverStatus } from '@common/enums';
import { WebhooksService } from '@modules/webhooks/webhooks.service';
import { SmsService } from '@modules/sms/sms.service';
import { StorageService } from '@modules/storage/storage.service';
import { I18nHelper } from '@i18n/i18n.utils';
import * as crypto from 'crypto';

@Injectable()
export class OrdersOtpService {
  constructor(
    private db: DatabaseService,
    private webhooksService: WebhooksService,
    private smsService: SmsService,
    private storageService: StorageService,
    private readonly i18n: I18nHelper,
  ) {}

  async generateAndSend(orderId: string, tenantId: string, driverId: string) {
    const order = await this.db.order.findFirst({
      where: { id: orderId, tenantId },
      include: { tenant: true },
    });

    if (!order) {
      throw new NotFoundException(this.i18n.t('errors.order.not_found'));
    }

    if (order.driverId !== driverId) {
      throw new BadRequestException(
        this.i18n.t('errors.order.not_assigned_to_you'),
      );
    }

    if (order.status !== OrderStatus.IN_TRANSIT) {
      throw new BadRequestException(
        this.i18n.t('errors.order.not_in_delivery_state'),
      );
    }

    const otpCode = this.generateOtp();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await this.db.order.update({
      where: { id: orderId },
      data: { otpCode, otpExpiresAt },
    });

    await this.smsService.sendDeliveryOtp({
      phone: order.recipientPhone,
      recipientName: order.recipientName,
      trackingCode: order.trackingCode,
      code: otpCode,
      senderName: order.tenant?.name ?? '',
      tenantId,
      orderId,
      lang: order.recipientLang,
    });

    return { message: this.i18n.t('errors.order.otp_sent') };
  }

  async verify(
    orderId: string,
    tenantId: string,
    driverId: string,
    code: string,
    photoFile?: Express.Multer.File,
  ) {
    const order = await this.db.order.findFirst({
      where: { id: orderId, tenantId },
    });

    if (!order) {
      throw new NotFoundException(this.i18n.t('errors.order.not_found'));
    }

    // Validate the request.
    if (order.driverId !== driverId) {
      throw new BadRequestException(
        this.i18n.t('errors.order.not_assigned_to_you'),
      );
    }

    if (!order.otpCode || !order.otpExpiresAt) {
      throw new BadRequestException(this.i18n.t('errors.order.otp_required'));
    }

    if (new Date() > order.otpExpiresAt) {
      throw new BadRequestException(
        this.i18n.t('errors.order.otp_expired_request_new'),
      );
    }

    if (order.otpCode !== code) {
      throw new BadRequestException(this.i18n.t('errors.order.otp_invalid'));
    }

    // Upload the photo if one was provided.
    let deliveryPhotoUrl: string | undefined;
    let deliveryPhotoKey: string | undefined;

    if (photoFile) {
      const uploaded = await this.storageService.uploadPhoto(
        photoFile,
        'delivery-photos',
        tenantId,
        {
          orderId,
          driverId,
          type: 'delivery-proof',
        },
      );
      deliveryPhotoUrl = uploaded.url;
      deliveryPhotoKey = uploaded.key;
    }

    // ✅ A valid OTP completes the delivery.
    const updatedOrder = await this.db.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.DELIVERED,
          otpCode: null, // Clear the OTP after use.
          otpExpiresAt: null,
          otpVerifiedAt: new Date(),
          deliveredAt: new Date(),
          deliveryPhoto: deliveryPhotoUrl,
          deliveryPhotoKey,
        },
      });

      // Release the driver.
      await tx.driver.update({
        where: { id: driverId },
        data: { status: DriverStatus.AVAILABLE },
      });

      // Add an entry to the history.
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: OrderStatus.IN_TRANSIT,
          toStatus: OrderStatus.DELIVERED,
          changedByType: 'driver',
          changedById: driverId,
          note: this.i18n.t('errors.order.history_delivered'),
        },
      });

      return updated;
    });

    await this.webhooksService.dispatch(
      tenantId,
      'order.delivered',
      updatedOrder,
    );

    return { message: this.i18n.t('errors.order.delivered_successfully') };
  }

  // ─── Private ──────────────────────────────────────────

  private generateOtp(): string {
    return crypto.randomInt(100000, 999999).toString();
  }
}
