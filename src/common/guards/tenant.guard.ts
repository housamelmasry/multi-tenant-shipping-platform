// src/common/guards/tenant.guard.ts
// Verify that the tenant ID in the route parameters belongs to the requester.

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { UserRole } from '../enums';
import { I18nHelper } from '@i18n/i18n.utils';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly i18n: I18nHelper) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const paramTenantId = request.params.tenantId;

    // Super admins can access any tenant.
    if (user.role === UserRole.SUPER_ADMIN) return true;

    // Tenant users can access only their own tenant.
    if (paramTenantId && user.tenantId !== paramTenantId) {
      throw new ForbiddenException(
        this.i18n.t('errors.common.forbidden_tenant'),
      );
    }

    return true;
  }
}
