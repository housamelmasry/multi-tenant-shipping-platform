// src/modules/tenants/dto/create-tenant.dto.ts
import {
  IsString,
  IsEmail,
  IsEnum,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Plan } from '@common/enums';

export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  // Points at the `validation.slug` catalog entry, resolved per request locale
  // by LocalizedValidationPipe.
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'validation.slug' })
  slug: string;

  @IsEnum(Plan)
  plan: Plan;

  // Initial company administrator details.
  @IsString()
  adminName: string;

  @IsEmail()
  adminEmail: string;

  @IsString()
  @MinLength(8)
  adminPassword: string;
}
