// src/common/guards/rate-limit.guard.ts
import {
  Injectable,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { DatabaseService } from '@database/database.service';
import { UserRole } from '@common/enums';

@Injectable()
export class CustomRateLimitGuard extends ThrottlerGuard {
  // Customize the error response.
  protected throwThrottlingException(): Promise<void> {
    throw new HttpException(
      {
        success: false,
        message: 'تجاوزت الحد المسموح به من الطلبات، يرجى المحاولة لاحقاً',
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
