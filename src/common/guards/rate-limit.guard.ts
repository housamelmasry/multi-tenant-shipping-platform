// src/common/guards/rate-limit.guard.ts
import {
  Injectable,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { I18nHelper } from '@i18n/i18n.utils';
import { ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';

@Injectable()
export class CustomRateLimitGuard extends ThrottlerGuard {
  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly i18n: I18nHelper,
  ) {
    super(options, storageService, reflector);
  }

  // Customize the error response.
  protected throwThrottlingException(): Promise<void> {
    throw new HttpException(
      {
        success: false,
        message: this.i18n.t('errors.common.rate_limited'),
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        retryAfter: 60, // seconds
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  // Choose a rate-limit key for each user type.
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const user = req.user;

    if (!user) {
      // Use the IP address when the request is unauthenticated.
      return `ip:${req.ip}`;
    }

    if (user.isTenant) {
      // Use the tenant ID for API-key authentication.
      return `tenant:${user.tenantId}`;
    }

    // Use the user ID for JWT authentication.
    return `user:${user.id}`;
  }
}
