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
import * as crypto from 'crypto';

@Injectable()
export class OrdersOtpService {
  constructor(
    private db: DatabaseService,
    private webhooksService: WebhooksService,
    private smsService: SmsService,
    private storageService: StorageService,
  ) {}

  async generateAndSend(orderId: string, tenantId: string, driverId: string) {
    const order = await this.db.order.findFirst({
      where: { id: orderId, tenantId },
      include: { tenant: true },
    });

    if (!order) throw new NotFoundException('الطلب غير موجود');

    if (order.driverId !== driverId) {
      throw new BadRequestException('هذا الطلب غير مخصص لك');
    }

    if (order.status !== OrderStatus.IN_TRANSIT) {
      throw new BadRequestException('الطلب ليس في حالة التوصيل');
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
    });

    return { message: 'تم إرسال رمز التحقق للعميل' };
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

    if (!order) throw new NotFoundException('الطلب غير موجود');

    // التحققات
    if (order.driverId !== driverId) {
      throw new BadRequestException('هذا الطلب غير مخصص لك');
    }

    if (!order.otpCode || !order.otpExpiresAt) {
      throw new BadRequestException('يجب طلب رمز التحقق أولاً');
    }

    if (new Date() > order.otpExpiresAt) {
      throw new BadRequestException(
        'انتهت صلاحية رمز التحقق، يرجى طلب رمز جديد',
      );
    }

    if (order.otpCode !== code) {
      throw new BadRequestException('رمز التحقق غير صحيح');
    }

    // رفع الصورة لو موجودة
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

    // ✅ OTP صحيح → إتمام التسليم
    const updatedOrder = await this.db.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.DELIVERED,
          otpCode: null, // مسح الـ OTP بعد الاستخدام
          otpExpiresAt: null,
          otpVerifiedAt: new Date(),
          deliveredAt: new Date(),
          deliveryPhoto: deliveryPhotoUrl,
          deliveryPhotoKey,
        },
      });

      // تحرير السائق
      await tx.driver.update({
        where: { id: driverId },
        data: { status: DriverStatus.AVAILABLE },
      });

      // تسجيل في التاريخ
      await tx.orderStatusHistory.create({
        data: {
          orderId,
          fromStatus: OrderStatus.IN_TRANSIT,
          toStatus: OrderStatus.DELIVERED,
          changedByType: 'driver',
          changedById: driverId,
          note: 'تم التسليم بنجاح مع التحقق من OTP',
        },
      });

      return updated;
    });

    await this.webhooksService.dispatch(
      tenantId,
      'order.delivered',
      updatedOrder,
    );

    return { message: 'تم التسليم بنجاح' };
  }

  // ─── Private ──────────────────────────────────────────

  private generateOtp(): string {
    return crypto.randomInt(100000, 999999).toString();
  }
}
