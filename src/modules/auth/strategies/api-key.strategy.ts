// src/modules/auth/strategies/api-key.strategy.ts
// للشركات اللي بتربط نظامها الخارجي
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { HeaderAPIKeyStrategy } from 'passport-headerapikey';
import { DatabaseService } from '@database/database.service';

@Injectable()
export class ApiKeyStrategy extends PassportStrategy(
  HeaderAPIKeyStrategy,
  'api-key',
) {
  constructor(private db: DatabaseService) {
    super(
      { header: 'X-API-Key', prefix: '' },
      true, // passReqToCallback
    );
  }

  async validate(apiKey: string) {
    const tenant = await this.db.tenant.findUnique({
      where: { apiKey, isActive: true },
    });

    if (!tenant) {
      throw new UnauthorizedException('API Key غير صالح');
    }

    // بيرجع tenant بدل user
    return { tenantId: tenant.id, isTenant: true };
  }
}

// تثبيت المكتبة
// npm install passport-headerapikey
