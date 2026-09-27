import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '@database/database.service';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private db: DatabaseService) {}

  async sendDeliveryOtp(params: {
    phone: string;
    recipientName: string;
    trackingCode: string;
    code: string;
    senderName: string;
    tenantId: string;
    orderId: string;
  }) {
    const message = `مرحباً ${params.recipientName}، رمز التحقق لاستلام طلبك ${params.trackingCode} هو: ${params.code} - ${params.senderName}`;

    return this.send({
      phone: params.phone,
      message,
      template: 'otp.delivery',
      tenantId: params.tenantId,
      orderId: params.orderId,
    });
  }

  async sendOrderNotification(params: {
    phone: string;
    template: string;
    recipientName: string;
    trackingCode: string;
    driverName?: string;
    driverPhone?: string;
    tenantId: string;
    orderId: string;
  }) {
    const messages: Record<string, string> = {
      'order.assigned': `مرحباً ${params.recipientName}، تم تعيين السائق ${params.driverName} (${params.driverPhone}) لتوصيل طلبك ${params.trackingCode}`,
      'order.in_transit': `مرحباً ${params.recipientName}، طلبك ${params.trackingCode} في الطريق إليك الآن 🚚`,
      'order.delivered': `مرحباً ${params.recipientName}، تم تسليم طلبك ${params.trackingCode} بنجاح ✅`,
      'order.failed': `مرحباً ${params.recipientName}، لم نتمكن من تسليم طلبك ${params.trackingCode}. سنتواصل معك قريباً`,
    };

    const message =
      messages[params.template] ?? `تحديث للطلب ${params.trackingCode}`;

    return this.send({
      phone: params.phone,
      message,
      template: params.template,
      tenantId: params.tenantId,
      orderId: params.orderId,
    });
  }

  async sendReturnOtp(params: {
    phone: string;
    orderId: string;
    code: string;
    tenantId: string;
  }) {
    const message = `رمز استلام المرتجع للطلب هو: ${params.code}`;

    return this.send({
      phone: params.phone,
      message,
      template: 'otp.return',
      tenantId: params.tenantId,
      orderId: params.orderId,
    });
  }

  private async send(params: {
    phone: string;
    message: string;
    template: string;
    tenantId?: string;
    orderId?: string;
  }) {
    // Save the record to the database first.
    const log = await this.db.smsLog.create({
      data: {
        tenantId: params.tenantId,
        orderId: params.orderId,
        phone: params.phone,
        message: params.message,
        template: params.template,
        status: 'pending',
      },
    });

    try {
      // TODO: Replace this with a real SMS provider.
      this.logger.log(`📱 SMS to ${params.phone}: ${params.message}`);

      await this.db.smsLog.update({
        where: { id: log.id },
        data: {
          status: 'sent',
          sentAt: new Date(),
        },
      });

      return { sent: true, id: log.id };
    } catch (error: any) {
      await this.db.smsLog.update({
        where: { id: log.id },
        data: {
          status: 'failed',
          responseBody: error.message,
        },
      });

      return { sent: false, id: log.id, error: error.message };
    }
  }
}
