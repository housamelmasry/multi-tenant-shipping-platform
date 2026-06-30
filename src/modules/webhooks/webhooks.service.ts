// src/modules/webhooks/webhooks.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { DatabaseService } from '@database/database.service';
import { CreateWebhookDto, WebhookEvent } from './dto/create-webhook.dto';
import { WebhookJobData } from './types/webhook-job.type';
import * as crypto from 'crypto';

export const WEBHOOK_QUEUE = 'webhooks';

@Injectable()
export class WebhooksService {
  constructor(
    private db: DatabaseService,
    @InjectQueue(WEBHOOK_QUEUE) private webhookQueue: Queue,
  ) {}

  // ─── CRUD ─────────────────────────────────────────────

  async create(tenantId: string, dto: CreateWebhookDto) {
    // كل tenant عنده webhook واحد بس لنفس الـ URL
    const existing = await this.db.webhook.findFirst({
      where: { tenantId, url: dto.url },
    });

    if (existing) {
      throw new ConflictException('هذا الـ URL مسجل بالفعل');
    }

    const secret = this.generateSecret();

    return this.db.webhook.create({
      data: {
        tenantId,
        url: dto.url,
        secret,
        events: dto.events,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.db.webhook.findMany({
      where: { tenantId },
      select: {
        id: true,
        url: true,
        events: true,
        isActive: true,
        createdAt: true,
        // مش نرجع الـ secret
      },
    });
  }

  async toggleStatus(id: string, tenantId: string) {
    const webhook = await this.assertWebhookBelongsToTenant(id, tenantId);

    return this.db.webhook.update({
      where: { id },
      data: { isActive: !webhook.isActive },
      select: { id: true, isActive: true },
    });
  }

  async delete(id: string, tenantId: string) {
    await this.assertWebhookBelongsToTenant(id, tenantId);
    await this.db.webhook.delete({ where: { id } });
    return { message: 'تم الحذف بنجاح' };
  }

  async rotateSecret(id: string, tenantId: string) {
    await this.assertWebhookBelongsToTenant(id, tenantId);
    const secret = this.generateSecret();

    await this.db.webhook.update({
      where: { id },
      data: { secret },
    });

    // نرجع الـ secret مرة واحدة بس
    return { secret };
  }

  // ─── Logs ─────────────────────────────────────────────

  async getLogs(tenantId: string, webhookId?: string) {
    return this.db.webhookLog.findMany({
      where: {
        webhook: { tenantId },
        ...(webhookId && { webhookId }),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        event: true,
        status: true,
        attempts: true,
        responseStatus: true,
        createdAt: true,
        order: {
          select: { trackingCode: true },
        },
      },
    });
  }

  async getLogDetail(logId: string, tenantId: string) {
    const log = await this.db.webhookLog.findFirst({
      where: {
        id: logId,
        webhook: { tenantId },
      },
    });

    if (!log) throw new NotFoundException('السجل غير موجود');
    return log;
  }

  // ─── Retry Manual ─────────────────────────────────────

  async retryLog(logId: string, tenantId: string) {
    const log = await this.db.webhookLog.findFirst({
      where: { id: logId, webhook: { tenantId } },
      include: { webhook: true },
    });

    if (!log) throw new NotFoundException('السجل غير موجود');

    if (log.status === 'success') {
      throw new ConflictException('هذا الإشعار تم إرساله بنجاح مسبقاً');
    }

    // إعادة الإضافة للـ queue
    await this.queueWebhookJob({
      webhookLogId: log.id,
      webhookId: log.webhookId,
      tenantId,
      url: log.webhook.url,
      secret: log.webhook.secret,
      event: log.event as any,
      payload: log.payload as any,
      attempt: 0,
    });

    return { message: 'تمت إعادة الجدولة بنجاح' };
  }

  // ─── Dispatch (يُستدعى من باقي الـ Services) ──────────

  async dispatch(tenantId: string, event: WebhookEvent, orderData: any) {
    // إيجاد كل الـ webhooks النشطة للـ tenant اللي مشتركة في هذا الحدث
    const webhooks = await this.db.webhook.findMany({
      where: {
        tenantId,
        isActive: true,
        events: { array_contains: event }, // MySQL JSON contains
      },
    });

    if (webhooks.length === 0) return;

    const payload = {
      event,
      timestamp: new Date().toISOString(),
      data: this.sanitizeOrderData(orderData),
    };

    // إنشاء log + إضافة لـ queue لكل webhook
    await Promise.all(
      webhooks.map((webhook) =>
        this.createLogAndQueue(webhook, event, payload, tenantId),
      ),
    );
  }

  // ─── Private ──────────────────────────────────────────

  private async createLogAndQueue(
    webhook: any,
    event: WebhookEvent,
    payload: any,
    tenantId: string,
  ) {
    // إنشاء الـ log أولاً
    const log = await this.db.webhookLog.create({
      data: {
        webhookId: webhook.id,
        orderId: payload.data.id,
        event,
        payload,
        status: 'pending',
        attempts: 0,
      },
    });

    // إضافة للـ queue
    await this.queueWebhookJob({
      webhookLogId: log.id,
      webhookId: webhook.id,
      tenantId,
      url: webhook.url,
      secret: webhook.secret,
      event,
      payload,
      attempt: 0,
    });
  }

  private async queueWebhookJob(data: WebhookJobData) {
    await this.webhookQueue.add('send', data, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }

  private sanitizeOrderData(order: any) {
    // نشيل البيانات الحساسة
    const { otpCode, otpExpiresAt, ...safeData } = order;
    return safeData;
  }

  private generateSecret(): string {
    return `whsec_${crypto.randomBytes(32).toString('hex')}`;
  }

  private async assertWebhookBelongsToTenant(id: string, tenantId: string) {
    const webhook = await this.db.webhook.findFirst({
      where: { id, tenantId },
    });
    if (!webhook) throw new NotFoundException('الـ Webhook غير موجود');
    return webhook;
  }
}
