// src/common/interceptors/privacy.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class PrivacyInterceptor implements NestInterceptor {
  // حقول يتم إخفاؤها جزئياً في الـ responses
  private readonly maskFields = ['nationalId', 'national_id'];

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => this.maskSensitiveData(data)));
  }

  private maskSensitiveData(data: any): any {
    if (!data || typeof data !== 'object') return data;

    if (Array.isArray(data)) {
      return data.map((item) => this.maskSensitiveData(item));
    }

    const masked = { ...data };

    for (const field of this.maskFields) {
      if (masked[field]) {
        masked[field] = this.maskValue(masked[field]);
      }
    }

    // معالجة الكائنات المتداخلة
    for (const key of Object.keys(masked)) {
      if (typeof masked[key] === 'object') {
        masked[key] = this.maskSensitiveData(masked[key]);
      }
    }

    return masked;
  }

  private maskValue(value: string): string {
    if (value.length <= 4) return '****';
    return value.slice(0, 2) + '*'.repeat(value.length - 4) + value.slice(-2);
    // 1234567890 → 12******90
  }
}
