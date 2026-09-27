import {
  IsUUID,
  IsEnum,
  IsString,
  IsOptional,
  IsLatitude,
  IsLongitude,
  IsIn,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReturnReason } from '@common/enums';
import {
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '@i18n/i18n.constants';

class WarehouseDto {
  @IsString()
  name: string;

  @IsString()
  phone: string;

  @IsString()
  address: string;

  @IsOptional()
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @IsLongitude()
  lng?: number;

  /**
   * Language the warehouse contact reads in.
   *
   * The warehouse OTP is sent to this number, so the order's recipient language
   * does not apply — the recipient is staff, not the end customer. Persisted on
   * the return request because the OTP is sent later, from a different request.
   */
  @IsOptional()
  @IsIn([...SUPPORTED_LANGUAGES])
  lang?: SupportedLanguage;
}

export class CreateReturnDto {
  @IsUUID()
  orderId: string;

  @IsEnum(ReturnReason)
  reason: ReturnReason;

  @IsOptional()
  @IsString()
  notes?: string;

  @ValidateNested()
  @Type(() => WarehouseDto)
  warehouse: WarehouseDto;
}
