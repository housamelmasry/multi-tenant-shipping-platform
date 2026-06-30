import {
  Injectable, Logger,
  NotFoundException, BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '@database/database.service';
import { StorageService } from '@modules/storage/storage.service';
import { RETENTION_POLICY } from '@common/constants/retention.constants';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class PdplService {
  private readonly logger = new Logger(PdplService.name);

  constructor(
    private db: DatabaseService,
    private storage: StorageService,
  ) {}

  // ─── Consent Management ───────────────────────────────

  async recordConsent(data: {
    tenantId: string;
    phone: string;
    entityType: string;
    entityId?: string;
    purpose: string;
    ipAddress?: string;
  }) {
    await this.db.consentLog.updateMany({
      where: {
        tenantId: data.tenantId,
        phone: data.phone,
        purpose: data.purpose,
        isActive: true,
      },
      data: { isActive: false, revokedAt: new Date() },
    });

    return this.db.consentLog.create({
      data: {
        tenantId: data.tenantId,
        phone: data.phone,
        entityType: data.entityType,
        entityId: data.entityId,
        purpose: data.purpose,
        ipAddress: data.ipAddress,
        version: '1.0',
      },
    });
  }

  async revokeConsent(tenantId: string, phone: string, purpose: string) {
    await this.db.consentLog.updateMany({
      where: { tenantId, phone, purpose, isActive: true },
      data: { isActive: false, revokedAt: new Date() },
    });

    return { message: 'تم سحب الموافقة بنجاح' };
  }

  async hasConsent(tenantId: string, phone: string, purpose: string) {
    const consent = await this.db.consentLog.findFirst({
      where: { tenantId, phone, purpose, isActive: true },
    });
    return !!consent;
  }

  // ─── Data Requests ────────────────────────────────────

  async createDataRequest(data: {
    tenantId: string;
    type: string;
    requesterType: string;
    phone?: string;
    driverId?: string;
    reason?: string;
  }) {
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + 30);

    const request = await this.db.dataRequest.create({
      data: {
        tenantId: data.tenantId,
        type: data.type as any,
        requesterType: data.requesterType,
        phone: data.phone,
        driverId: data.driverId,
        reason: data.reason,
        status: 'PENDING',
        dueAt,
      },
    });

    this.logger.log(
      `Data request created: ${data.type} for ${data.phone ?? data.driverId}`,
    );

    return request;
  }

  async getDataRequests(tenantId: string) {
    return this.db.dataRequest.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        driver: { select: { id: true, name: true, phone: true } },
      },
    });
  }

  // ─── Right of Access (حق الاطلاع) ────────────────────

  async generateDataReport(requestId: string, tenantId: string) {
    const request = await this.db.dataRequest.findFirst({
      where: { id: requestId, tenantId, type: 'ACCESS' },
    });

    if (!request) throw new NotFoundException('الطلب غير موجود');

    let report: Record<string, any> = {};

    if (request.phone) {
      const orders = await this.db.order.findMany({
        where: { tenantId, recipientPhone: request.phone },
        select: {
          trackingCode: true,
          status: true,
          recipientName: true,
          recipientAddress: true,
          createdAt: true,
          deliveredAt: true,
        },
      });

      const consents = await this.db.consentLog.findMany({
        where: { tenantId, phone: request.phone },
        select: { purpose: true, consentedAt: true, revokedAt: true, isActive: true },
      });

      report = {
        dataSubject: { phone: request.phone },
        orders,
        totalOrders: orders.length,
        consents,
        generatedAt: new Date().toISOString(),
        retentionInfo: 'يتم الاحتفاظ ببياناتك لمدة 3 سنوات وفقاً لسياسة الخصوصية',
      };
    }

    if (request.driverId) {
      const driver = await this.db.driver.findUnique({
        where: { id: request.driverId },
        select: {
          name: true,
          phone: true,
          email: true,
          vehicleType: true,
          vehiclePlate: true,
          createdAt: true,
        },
      });

      const deliveries = await this.db.order.count({
        where: { driverId: request.driverId, status: 'delivered' },
      });

      report = {
        dataSubject: driver,
        totalDeliveries: deliveries,
        generatedAt: new Date().toISOString(),
      };
    }

    await this.db.dataRequest.update({
      where: { id: requestId },
      data: { status: 'COMPLETED', handledAt: new Date() },
    });

    return report;
  }

  // ─── Right of Erasure (حق الحذف) ─────────────────────

  async anonymizeCustomerData(tenantId: string, phone: string) {
    const anonymizedName = '[محذوف]';
    const anonymizedPhone = `+966**${phone.slice(-4)}`;

    const updated = await this.db.order.updateMany({
      where: { tenantId, recipientPhone: phone },
      data: {
        recipientName: anonymizedName,
        recipientPhone: anonymizedPhone,
        recipientAddress: '[محذوف]',
        recipientLat: null,
        recipientLng: null,
        senderName: anonymizedName,
        senderPhone: anonymizedPhone,
      },
    });

    await this.revokeConsent(tenantId, phone, 'delivery');
    await this.revokeConsent(tenantId, phone, 'marketing');

    this.logger.log(`Anonymized ${updated.count} orders for ${anonymizedPhone}`);

    return {
      message: 'تم إخفاء البيانات الشخصية بنجاح',
      affectedOrders: updated.count,
    };
  }

  async deleteDriverData(tenantId: string, driverId: string) {
    const driver = await this.db.driver.findFirst({
      where: { id: driverId, tenantId },
    });

    if (!driver) throw new NotFoundException('السائق غير موجود');

    const activeOrders = await this.db.order.count({
      where: {
        driverId,
        status: { in: ['assigned', 'picked_up', 'in_transit'] },
      },
    });

    if (activeOrders > 0) {
      throw new BadRequestException(
        'لا يمكن حذف بيانات السائق لوجود طلبات نشطة',
      );
    }

    await this.db.$transaction(async (tx) => {
      await tx.driver.update({
        where: { id: driverId },
        data: {
          name: '[محذوف]',
          phone: `+966**${driver.phone.slice(-4)}`,
          email: null,
          nationalId: '[محذوف]',
          currentLat: null,
          currentLng: null,
          isActive: false,
        },
      });

      await tx.driver.update({
        where: { id: driverId },
        data: { fcmToken: null },
      });
    });

    return { message: 'تم حذف البيانات الشخصية للسائق بنجاح' };
  }

  // ─── Data Access Logging ──────────────────────────────

  async logDataAccess(data: {
    userId: string;
    tenantId?: string;
    action: 'view' | 'export' | 'delete' | 'update';
    dataType: string;
    entityType: string;
    entityId: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    await this.db.dataAccessLog.create({ data });
  }

  // ─── Breach Notification ──────────────────────────────

  async reportBreach(data: {
    tenantId?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    affectedEntities: number;
    dataTypes: string[];
    detectedAt: Date;
    actions?: string[];
  }) {
    const breach = await this.db.breachLog.create({
      data: {
        tenantId: data.tenantId,
        severity: data.severity,
        description: data.description,
        affectedEntities: data.affectedEntities,
        dataTypes: data.dataTypes,
        detectedAt: data.detectedAt,
        actions: data.actions ?? [],
      },
    });

    if (['critical', 'high'].includes(data.severity)) {
      this.logger.error(
        `BREACH DETECTED | Severity: ${data.severity} | Affected: ${data.affectedEntities}`,
      );
      await this.notifySdaia(breach);
    }

    return breach;
  }

  // ─── Automated Cleanup (Cron Jobs) ───────────────────

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async runRetentionCleanup() {
    this.logger.log('بدء تنظيف البيانات المنتهية مدة احتفاظها...');

    await Promise.all([
      this.cleanupCompletedOrders(),
      this.cleanupSmsLogs(),
      this.cleanupWebhookLogs(),
      this.cleanupAccessLogs(),
      this.cleanupDeliveryPhotos(),
    ]);

    this.logger.log('انتهى التنظيف التلقائي');
  }

  private async cleanupCompletedOrders() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_POLICY.orders.anonymizeAfter);

    const orders = await this.db.order.findMany({
      where: {
        status: { in: ['delivered', 'cancelled', 'returned'] },
        updatedAt: { lt: cutoff },
        recipientPhone: { not: { startsWith: '+966**' } },
      },
      select: { id: true, tenantId: true, recipientPhone: true },
    });

    for (const order of orders) {
      if (!order.recipientPhone) continue;
      await this.anonymizeCustomerData(order.tenantId!, order.recipientPhone);
    }

    if (orders.length > 0) {
      this.logger.log(`Anonymized ${orders.length} old orders`);
    }
  }

  private async cleanupSmsLogs() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_POLICY.smsLogs.retentionDays);

    const { count } = await this.db.smsLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    if (count > 0) this.logger.log(`Deleted ${count} old SMS logs`);
  }

  private async cleanupWebhookLogs() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_POLICY.webhookLogs.retentionDays);

    const { count } = await this.db.webhookLog.deleteMany({
      where: {
        createdAt: { lt: cutoff },
        status: 'success',
      },
    });

    if (count > 0) this.logger.log(`Deleted ${count} old webhook logs`);
  }

  private async cleanupAccessLogs() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_POLICY.accessLogs.retentionDays);

    const { count } = await this.db.dataAccessLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    if (count > 0) this.logger.log(`Deleted ${count} old access logs`);
  }

  private async cleanupDeliveryPhotos() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_POLICY.photos.deliveryDays);

    const orders = await this.db.order.findMany({
      where: {
        deliveryPhotoKey: { not: null },
        deliveredAt: { lt: cutoff },
      },
      select: { id: true, deliveryPhotoKey: true },
    });

    for (const order of orders) {
      await this.storage.deletePhoto(order.deliveryPhotoKey as string);
      await this.db.order.update({
        where: { id: order.id },
        data: { deliveryPhotoKey: null, deliveryPhoto: null },
      });
    }

    if (orders.length > 0) {
      this.logger.log(`Deleted ${orders.length} old delivery photos`);
    }
  }

  private async notifySdaia(breach: any) {
    this.logger.error(
      `SDAIA Notification Required for breach: ${breach.id}`,
    );
  }
}
