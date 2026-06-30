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
  // تخصيص رسالة الخطأ
  protected throwThrottlingException(): Promise<void> {
    throw new HttpException(
      {
        success: false,
        message: 'تجاوزت الحد المسموح به من الطلبات، يرجى المحاولة لاحقاً',
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        retryAfter: 60, // ثانية
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  // تخصيص الـ key لكل نوع مستخدم
  protected async getTracker(req: Record<string, any>): Promise<string> {
    const user = req.user;

    if (!user) {
      // بدون auth → نستخدم الـ IP
      return `ip:${req.ip}`;
    }

    if (user.isTenant) {
      // API Key auth → نستخدم الـ tenantId
      return `tenant:${user.tenantId}`;
    }

    // JWT auth → نستخدم الـ userId
    return `user:${user.id}`;
  }
}
