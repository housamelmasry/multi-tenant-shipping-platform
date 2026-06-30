// src/common/guards/api-key-rate-limit.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { REDIS_CLIENT } from '../../redis/redis.module';
import { Redis } from 'ioredis';
import { DatabaseService } from '@database/database.service';

// حدود كل باقة يومياً
const PLAN_LIMITS = {
  BASIC: 1_000,
  PRO: 10_000,
  ENTERPRISE: 100_000,
} as const;

@Injectable()
export class ApiKeyRateLimitGuard implements CanActivate {
  constructor(
    @Inject(REDIS_CLIENT) private redis: Redis,
    private db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // هذا الـ guard للـ API Key فقط
    if (!user?.isTenant) return true;

    const tenantId = user.tenantId;
    const today = new Date().toISOString().split('T')[0]; // 2024-01-15
    const key = `ratelimit:api:${tenantId}:${today}`;

    // جلب الباقة من الـ DB (مع cache)
    const limit = await this.getTenantLimit(tenantId);

    // increment و expire
    const result = await this.redis
      .multi()
      .incr(key)
      .expire(key, 86400)
      .exec();

    const count = result?.[0]?.[1] as number ?? 1;

    // إضافة headers للـ response
    const response = context.switchToHttp().getResponse();
    response.setHeader('X-RateLimit-Limit', limit);
    response.setHeader('X-RateLimit-Remaining', Math.max(0, limit - count));
    response.setHeader('X-RateLimit-Reset', this.getResetTime());
    response.setHeader('X-RateLimit-Used', count);

    if (count > limit) {
      // تسجيل التجاوز
      await this.logExceededLimit(tenantId, count, limit);

      throw new HttpException(
        {
          success: false,
          message: `تجاوزت الحد اليومي للـ API (${limit.toLocaleString()} طلب/يوم)`,
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          limit,
          used: count,
          resetAt: this.getResetTime(),
          upgradeUrl: 'https://yourapp.com/pricing',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private async getTenantLimit(tenantId: string): Promise<number> {
    // Cache في Redis لـ 10 دقائق
    const cacheKey = `tenant:plan:${tenantId}`;
    const cached = await this.redis.get(cacheKey);

    if (cached) return parseInt(cached);

    const tenant = await this.db.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true },
    });

    const limit = PLAN_LIMITS[tenant?.plan ?? 'BASIC'];
    await this.redis.setex(cacheKey, 600, limit.toString()); // 10 دقائق

    return limit;
  }

  private getResetTime(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.toISOString();
  }

  private async logExceededLimit(
    tenantId: string,
    count: number,
    limit: number,
  ) {
    // يمكن إرسال تنبيه للـ super admin
    console.warn(
      `⚠️ Rate limit exceeded | Tenant: ${tenantId} | Used: ${count}/${limit}`,
    );
  }
}
