// src/modules/tenants/dto/create-tenant.dto.ts
import {
  IsString,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Plan } from '@common/enums';
import {
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '@i18n/i18n.constants';

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

  /**
   * Language for the initial administrator's messages. Defaults to the
   * language of the request that creates the tenant.
   */
  @IsOptional()
  @IsIn([...SUPPORTED_LANGUAGES])
  adminLang?: SupportedLanguage;
}
