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

  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'الـ slug يجب أن يحتوي على أحرف صغيرة وأرقام وشرطة فقط',
  })
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
