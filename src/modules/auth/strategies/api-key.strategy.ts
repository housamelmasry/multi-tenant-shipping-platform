// src/modules/auth/strategies/api-key.strategy.ts
// Authenticate external company integrations.
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

    // Return the tenant instead of the user.
    return { tenantId: tenant.id, isTenant: true };
  }
}

// Install the package.
// npm install passport-headerapikey
