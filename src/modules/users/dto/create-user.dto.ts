import { IsEmail, IsString, IsEnum, IsIn, IsOptional } from 'class-validator';
import { UserRole } from '@common/enums';
import {
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '@i18n/i18n.constants';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsString()
  name: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsString()
  @IsOptional()
  tenantId?: string;

  /** Language for messages addressed to this user. Defaults to the request locale. */
  @IsOptional()
  @IsIn([...SUPPORTED_LANGUAGES])
  lang?: SupportedLanguage;
}
