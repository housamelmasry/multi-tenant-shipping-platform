// src/modules/sms/sms.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '@database/database.service';
import { I18nHelper } from '@i18n/i18n.utils';

type SmsTemplate =
  | 'otp.delivery'
  | 'otp.return'
  | 'order.created'
  | 'order.assigned'
  | 'order.in_transit'
  | 'order.delivered'
  | 'order.failed';

/**
 * Order statuses that trigger a customer SMS, mapped to their template.
 *
 * Declared as a lookup rather than a status array so the template stays a
 * checked member of SmsTemplate: a `template` string built by concatenation
 * would silently fall through to a missing catalog key at runtime.
 */
export const ORDER_NOTIFICATION_TEMPLATES = {
  in_transit: 'order.in_transit',
  delivered: 'order.delivered',
  failed: 'order.failed',
} as const satisfies Record<string, SmsTemplate>;

export type NotifiableOrderStatus = keyof typeof ORDER_NOTIFICATION_TEMPLATES;

export const orderNotificationTemplate = (
  status: string,
): SmsTemplate | undefined =>
  ORDER_NOTIFICATION_TEMPLATES[status as NotifiableOrderStatus];

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(
    private db: DatabaseService,
    private readonly config: ConfigService,
    private readonly i18n: I18nHelper,
  ) {}

  /**
   * `lang` carries the recipient's preferred language. SMS is dispatched
   * inline but is a side effect with no response to read the locale from, so
   * the caller must supply it explicitly rather than relying on the request
   * context. Anything omitted falls back to the default language.
   */
  async sendDeliveryOtp(params: {
    phone: string;
    recipientName: string;
    trackingCode: string;
    code: string;
    senderName: string;
    tenantId: string;
    orderId: string;
    lang?: string;
  }) {
    const message = this.i18n.t('sms.otp.delivery', {
      lang: params.lang,
      args: {
        recipientName: params.recipientName,
        trackingCode: params.trackingCode,
        code: params.code,
        senderName: params.senderName,
      },
    });

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
    template: SmsTemplate;
    recipientName: string;
    trackingCode: string;
    driverName?: string;
    driverPhone?: string;
    tenantId: string;
    orderId: string;
    lang?: string;
  }) {
    const message = this.i18n.t(`sms.${params.template}`, {
      lang: params.lang,
      args: {
        recipientName: params.recipientName,
        trackingCode: params.trackingCode,
        driverName: params.driverName ?? '',
        driverPhone: params.driverPhone ?? '',
        trackingUrl: this.trackingUrl(params.trackingCode),
      },
    });

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
    lang?: string;
  }) {
    const message = this.i18n.t('sms.otp.return', {
      lang: params.lang,
      args: { orderId: params.orderId, code: params.code },
    });

    return this.send({
      phone: params.phone,
      message,
      template: 'otp.return',
      tenantId: params.tenantId,
      orderId: params.orderId,
    });
  }

  /** Customer-facing tracking link; sms templates reference it as {trackingUrl}. */
  private trackingUrl(trackingCode: string): string {
    const base = this.config.get<string>('app.publicUrl') ?? '';
    return `${base.replace(/\/$/, '')}/track/${trackingCode}`;
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

    const reason = 'SMS provider is not configured';
    await this.db.smsLog.update({
      where: { id: log.id },
      data: {
        status: 'failed',
        responseBody: reason,
      },
    });

    this.logger.warn(`SMS not sent because no provider is configured (log ${log.id})`);
    return { sent: false, id: log.id, reason: 'provider_unavailable' };
  }
}
