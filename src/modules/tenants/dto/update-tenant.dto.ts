// src/modules/tenants/dto/update-tenant.dto.ts
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateTenantDto } from './create-tenant.dto';

// كل حاجة optional عدا بيانات الـ admin
export class UpdateTenantDto extends PartialType(
  OmitType(CreateTenantDto, ['adminName', 'adminEmail', 'adminPassword']),
) {}
