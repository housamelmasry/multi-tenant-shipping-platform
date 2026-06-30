// src/common/guards/tenant.guard.ts
// يتأكد إن الـ tenant_id في الـ params
// ينفع للـ tenant اللي بيطلب بياناته هو بس

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { UserRole } from '../enums';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const paramTenantId = request.params.tenantId;

    // Super admin يدخل على أي tenant
    if (user.role === UserRole.SUPER_ADMIN) return true;

    // Tenant user يدخل على tenant بتاعه بس
    if (paramTenantId && user.tenantId !== paramTenantId) {
      throw new ForbiddenException('ليس لديك صلاحية للوصول لهذه الشركة');
    }

    return true;
  }
}
