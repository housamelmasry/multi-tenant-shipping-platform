// src/modules/orders/orders-otp.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '@database/database.service';
import { OrderStatus, DriverStatus } from '@common/enums';
import { WebhooksService } from '@modules/webhooks/webhooks.service';
import * as crypto from 'crypto';

@Injectable()
export class OrdersOtpService {
  constructor(
    private db: DatabaseService,
    private webhooksService: WebhooksService,
  ) {}

  async generateAndSend(orderId: string, tenantId: string, driverId: string) {
    const order = await this.db.order.findFirst({
      where: { id: orderId, tenantId },
    });

    if (!order) throw new NotFoundException('الطلب غير موجود');

    if (order.driverId !== driverId) {
      throw new BadRequestException('هذا الطلب غير مخصص لك');
    }

    if (order.status !== OrderStatus.IN_TRANSIT) {
      throw new BadRequestException('الطلب ليس في حالة التوصيل');
    }

    // توليد OTP
    const otpCode = this.generateOtp();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 دقائق

    await this.db.order.update({
      where: { id: orderId },
      data: { otpCode, otpExpiresAt },
    });

    // إرسال SMS للعميل
    await this.sendSms(order.recipientPhone, otpCode);

    return { message: 'تم إرسال رمز التحقق للعميل' };
  }

  async verify(
    orderId: string,
    tenantId: string,
    driverId: string,
    code: string,
    deliveryPhoto?: string,
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
          deliveryPhoto,
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

  private async sendSms(phone: string, code: string) {
    // هنا هتتكامل مع Unifonic أو أي SMS provider
    // مؤقتاً بـ log
    console.log(`📱 SMS to ${phone}: رمز التحقق هو ${code}`);

    // لما تجهز الـ SMS provider:
    // await this.smsService.send(phone, `رمز التحقق الخاص بطلبك هو: ${code}`);
  }
}
