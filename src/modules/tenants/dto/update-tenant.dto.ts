// src/modules/tenants/dto/update-tenant.dto.ts
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateTenantDto } from './create-tenant.dto';

// All fields are optional except the administrator details.
export class UpdateTenantDto extends PartialType(
  OmitType(CreateTenantDto, ['adminName', 'adminEmail', 'adminPassword']),
) {}
