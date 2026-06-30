import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '@database/database.service';
import { CreateConsentDto } from './dto/create-consent.dto';
import { QueryConsentDto } from './dto/query-consent.dto';
import { CreateDataRequestDto } from './dto/create-data-request.dto';
import { HandleDataRequestDto } from './dto/handle-data-request.dto';
import { QueryDataRequestDto } from './dto/query-data-request.dto';
import { CreateBreachDto } from './dto/create-breach.dto';
import { ResolveBreachDto } from './dto/resolve-breach.dto';
import { QueryBreachDto } from './dto/query-breach.dto';
import { QueryAccessLogDto } from './dto/query-access-log.dto';

@Injectable()
export class PdplService {
  constructor(private db: DatabaseService) {}

  // ─── Consent Log ───────────────────────────────────────

  async recordConsent(dto: CreateConsentDto) {
    return this.db.consentLog.create({
      data: {
        tenantId: dto.tenantId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        phone: dto.phone,
        purpose: dto.purpose,
        version: dto.version ?? '1.0',
        ipAddress: dto.ipAddress,
      },
    });
  }

  async listConsent(tenantId: string, query: QueryConsentDto) {
    const { phone, purpose, entityType, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(phone && { phone: { contains: phone } }),
      ...(purpose && { purpose }),
      ...(entityType && { entityType }),
    };

    const [data, total] = await Promise.all([
      this.db.consentLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { consentedAt: 'desc' },
      }),
      this.db.consentLog.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getConsent(id: string, tenantId: string) {
    const record = await this.db.consentLog.findFirst({
      where: { id, tenantId },
    });
    if (!record) throw new NotFoundException('سجل الموافقة غير موجود');
    return record;
  }

  async revokeConsent(id: string, tenantId: string) {
    const record = await this.db.consentLog.findFirst({
      where: { id, tenantId, isActive: true },
    });
    if (!record) throw new NotFoundException('سجل الموافقة غير موجود أو ملغي بالفعل');

    return this.db.consentLog.update({
      where: { id },
      data: { isActive: false, revokedAt: new Date() },
    });
  }

  // ─── Data Request ──────────────────────────────────────

  async createDataRequest(dto: CreateDataRequestDto) {
    const dueAt = new Date();
    dueAt.setDate(dueAt.getDate() + 30);

    return this.db.dataRequest.create({
      data: {
        tenantId: dto.tenantId,
        type: dto.type,
        requesterType: dto.requesterType,
        phone: dto.phone,
        driverId: dto.driverId,
        reason: dto.reason,
        dueAt,
      },
    });
  }

  async listDataRequests(tenantId: string, query: QueryDataRequestDto) {
    const { status, type, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      tenantId,
      ...(status && { status }),
      ...(type && { type }),
    };

    const [data, total] = await Promise.all([
      this.db.dataRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          driver: { select: { id: true, name: true, phone: true } },
        },
      }),
      this.db.dataRequest.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getDataRequest(id: string, tenantId: string) {
    const request = await this.db.dataRequest.findFirst({
      where: { id, tenantId },
      include: {
        driver: { select: { id: true, name: true, phone: true } },
      },
    });
    if (!request) throw new NotFoundException('طلب البيانات غير موجود');
    return request;
  }

  async handleDataRequest(
    id: string,
    tenantId: string,
    userId: string,
    dto: HandleDataRequestDto,
  ) {
    const request = await this.db.dataRequest.findFirst({
      where: { id, tenantId },
    });
    if (!request) throw new NotFoundException('طلب البيانات غير موجود');

    if (request.status !== 'PENDING' && request.status !== 'IN_PROGRESS') {
      throw new BadRequestException('لا يمكن معالجة الطلب في حالته الحالية');
    }

    return this.db.dataRequest.update({
      where: { id },
      data: {
        status: dto.status,
        notes: dto.notes,
        reportUrl: dto.reportUrl,
        handledBy: userId,
        handledAt: new Date(),
      },
    });
  }

  // ─── Breach Log ────────────────────────────────────────

  async createBreach(dto: CreateBreachDto) {
    return this.db.breachLog.create({
      data: {
        tenantId: dto.tenantId,
        severity: dto.severity,
        description: dto.description,
        affectedEntities: dto.affectedEntities ?? 0,
        dataTypes: dto.dataTypes ?? [],
        detectedAt: new Date(),
        actions: dto.actions,
      },
    });
  }

  async listBreaches(query: QueryBreachDto) {
    const { severity, tenantId, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(severity && { severity }),
      ...(tenantId && { tenantId }),
    };

    const [data, total] = await Promise.all([
      this.db.breachLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { detectedAt: 'desc' },
      }),
      this.db.breachLog.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getBreach(id: string) {
    const breach = await this.db.breachLog.findUnique({ where: { id } });
    if (!breach) throw new NotFoundException('سجل الاختراق غير موجود');
    return breach;
  }

  async resolveBreach(id: string, dto: ResolveBreachDto) {
    const breach = await this.db.breachLog.findUnique({ where: { id } });
    if (!breach) throw new NotFoundException('سجل الاختراق غير موجود');

    if (breach.resolvedAt) {
      throw new BadRequestException('تم حل هذا الاختراق مسبقاً');
    }

    return this.db.breachLog.update({
      where: { id },
      data: {
      resolvedAt: new Date(),
      reportedAt: dto.notes ? new Date() : undefined,
      actions: dto.actions ?? (breach.actions ?? undefined),
      },
    });
  }

  async reportBreach(id: string) {
    const breach = await this.db.breachLog.findUnique({ where: { id } });
    if (!breach) throw new NotFoundException('سجل الاختراق غير موجود');

    return this.db.breachLog.update({
      where: { id },
      data: { reportedAt: new Date() },
    });
  }

  // ─── Data Access Log (read-only) ────────────────────────

  async listAccessLogs(query: QueryAccessLogDto) {
    const {
      userId, action, dataType, entityType, entityId,
      page = 1, limit = 20,
    } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(userId && { userId }),
      ...(action && { action }),
      ...(dataType && { dataType }),
      ...(entityType && { entityType }),
      ...(entityId && { entityId }),
    };

    const [data, total] = await Promise.all([
      this.db.dataAccessLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.dataAccessLog.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── Log Access (internal, called by other services) ────

  async logAccess(data: {
    tenantId?: string;
    userId: string;
    action: string;
    dataType: string;
    entityType: string;
    entityId: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    return this.db.dataAccessLog.create({ data });
  }
}
