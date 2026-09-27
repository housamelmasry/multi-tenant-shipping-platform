// src/modules/tenants/tenants.service.ts
import {
  Injectable,
  Inject,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { DatabaseService } from '@database/database.service';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { Redis } from 'ioredis';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { QueryTenantDto } from './dto/query-tenant.dto';
import { RegenerateApiKeyDto } from './dto/regenerate-api-key.dto';
import { UserRole } from '@common/enums';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Injectable()
export class TenantsService {
  constructor(
    private db: DatabaseService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  // ─── Super Admin Only ────────────────────────────────

  async create(dto: CreateTenantDto) {
    // 1. Check uniqueness.
    await this.assertSlugUnique(dto.slug);
    await this.assertAdminEmailUnique(dto.adminEmail);

    // 2. Generate API credentials.
    const apiKey = this.generateApiKey();
    const apiSecret = this.generateApiSecret();

    // 3. Hash the password.
    const hashedPassword = await bcrypt.hash(dto.adminPassword, 12);

    // 4. Create the tenant and administrator in a transaction.
    const tenant = await this.db.$transaction(async (tx) => {
      const newTenant = await tx.tenant.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          plan: dto.plan,
          apiKey,
          apiSecret,
        },
      });

      await tx.user.create({
        data: {
          tenantId: newTenant.id,
          name: dto.adminName,
          email: dto.adminEmail,
          password: hashedPassword,
          role: UserRole.TENANT_ADMIN,
        },
      });

      return newTenant;
    });

    return {
      ...tenant,
      // Return the API key only once, when the tenant is created.
      apiKey,
      apiSecret,
    };
  }

  async findAll(query: QueryTenantDto) {
    const { search, plan, isActive, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(search && {
        OR: [{ name: { contains: search } }, { slug: { contains: search } }],
      }),
      ...(plan && { plan }),
      ...(isActive !== undefined && { isActive }),
    };

    const [tenants, total] = await Promise.all([
      this.db.tenant.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          isActive: true,
          createdAt: true,
          _count: {
            select: {
              orders: true,
              drivers: true,
              users: true,
            },
          },
        },
      }),
      this.db.tenant.count({ where }),
    ]);

    return {
      data: tenants,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const tenant = await this.db.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            orders: true,
            drivers: true,
            users: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('الشركة غير موجودة');
    }

    // Never return the API secret.
    const { apiSecret, ...safeTenant } = tenant;
    return safeTenant;
  }

  async update(id: string, dto: UpdateTenantDto) {
    await this.assertTenantExists(id);

    if (dto.slug) {
      await this.assertSlugUnique(dto.slug, id);
    }

    return this.db.tenant.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  async toggleStatus(id: string) {
    const tenant = await this.assertTenantExists(id);

    return this.db.tenant.update({
      where: { id },
      data: { isActive: !tenant.isActive },
      select: { id: true, isActive: true },
    });
  }

  async regenerateApiKey(id: string, dto: RegenerateApiKeyDto, userId: string) {
    // Verify the password before regenerating the key.
    const user = await this.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('المستخدم غير موجود');
    }

    const isValid = await bcrypt.compare(dto.password, user.password);

    if (!isValid) {
      throw new UnauthorizedException('كلمة المرور غير صحيحة');
    }

    const apiKey = this.generateApiKey();
    const apiSecret = this.generateApiSecret();

    await this.db.tenant.update({
      where: { id },
      data: { apiKey, apiSecret },
    });

    // Return the credentials only once.
    return { apiKey, apiSecret };
  }

  // ─── Tenant Admin ────────────────────────────────────

  async updateSettings(tenantId: string, settings: Record<string, any>) {
    const tenant = await this.db.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });
    if (!tenant) throw new NotFoundException('الشركة غير موجودة');

    const currentSettings = (tenant.settings as object) ?? {};
    const newSettings = { ...currentSettings, ...settings };

    return this.db.tenant.update({
      where: { id: tenantId },
      data: { settings: newSettings },
      select: { id: true, settings: true },
    });
  }

  async getMyTenant(tenantId: string) {
    return this.findOne(tenantId);
  }

  async getMyStats(tenantId: string) {
    const [
      totalOrders,
      pendingOrders,
      deliveredOrders,
      failedOrders,
      totalDrivers,
      activeDrivers,
    ] = await Promise.all([
      this.db.order.count({ where: { tenantId } }),
      this.db.order.count({ where: { tenantId, status: 'pending' } }),
      this.db.order.count({ where: { tenantId, status: 'delivered' } }),
      this.db.order.count({ where: { tenantId, status: 'failed' } }),
      this.db.driver.count({ where: { tenantId } }),
      this.db.driver.count({ where: { tenantId, status: 'available' } }),
    ]);

    const deliveryRate =
      totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0;

    return {
      orders: {
        total: totalOrders,
        pending: pendingOrders,
        delivered: deliveredOrders,
        failed: failedOrders,
        deliveryRate: `${deliveryRate}%`,
      },
      drivers: {
        total: totalDrivers,
        active: activeDrivers,
      },
    };
  }

  async getApiUsage(tenantId: string) {
    const today = new Date().toISOString().split('T')[0];
    const key = `ratelimit:api:${tenantId}:${today}`;
    const used = parseInt((await this.redis.get(key)) ?? '0');
    const tenant = await this.db.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true },
    });

    const PLAN_LIMITS: Record<string, number> = {
      BASIC: 1000,
      PRO: 10000,
      ENTERPRISE: 100000,
    };
    const limit = PLAN_LIMITS[tenant?.plan ?? 'BASIC'] ?? 1000;

    const last7Days = await Promise.all(
      Array.from({ length: 7 }, async (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const dayKey = `ratelimit:api:${tenantId}:${dateStr}`;
        const count = parseInt((await this.redis.get(dayKey)) ?? '0');
        return { date: dateStr, requests: count };
      }),
    );

    return {
      today: {
        used,
        limit,
        remaining: Math.max(0, limit - used),
        percentage: Math.round((used / limit) * 100),
      },
      plan: tenant?.plan,
      last7Days: last7Days.reverse(),
      resetAt: this.getResetTime(),
    };
  }

  // ─── Private Helpers ─────────────────────────────────

  private async assertTenantExists(id: string) {
    const tenant = await this.db.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('الشركة غير موجودة');
    return tenant;
  }

  private async assertSlugUnique(slug: string, excludeId?: string) {
    const existing = await this.db.tenant.findUnique({ where: { slug } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException('هذا الـ slug مستخدم بالفعل');
    }
  }

  private async assertAdminEmailUnique(email: string) {
    const existing = await this.db.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('هذا الإيميل مستخدم بالفعل');
    }
  }

  private generateApiKey(): string {
    return `sk_${crypto.randomBytes(24).toString('hex')}`;
  }

  private generateApiSecret(): string {
    return `secret_${crypto.randomBytes(32).toString('hex')}`;
  }

  private getResetTime(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.toISOString();
  }
}
