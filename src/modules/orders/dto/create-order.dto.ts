// src/modules/orders/dto/create-order.dto.ts
import {
  IsString,
  IsOptional,
  IsNumber,
  IsPhoneNumber,
  IsDecimal,
  Min,
  ValidateNested,
  IsLatitude,
  IsLongitude,
} from 'class-validator';
import { Type } from 'class-transformer';

class AddressDto {
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

export class CreateOrderDto {
  @ValidateNested()
  @Type(() => AddressDto)
  sender: AddressDto;

  @ValidateNested()
  @Type(() => AddressDto)
  recipient: AddressDto;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  codAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  externalRef?: string; // رقم الطلب في نظام الشركة
}
