import {
  IsUUID, IsEnum, IsString,
  IsOptional, IsLatitude, IsLongitude,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ReturnReason } from '@common/enums';

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
