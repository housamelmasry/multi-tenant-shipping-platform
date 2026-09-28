// src/modules/tenants/dto/update-tenant.dto.ts
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateTenantDto } from './create-tenant.dto';

// All fields are optional except the administrator details. `adminLang` is
// create-only for the same reason: it is written to the initial User row, and
// `Tenant` has no such column, so `data: dto` would reject it.
export class UpdateTenantDto extends PartialType(
  OmitType(CreateTenantDto, [
    'adminName',
    'adminEmail',
    'adminPassword',
    'adminLang',
  ]),
) {}
