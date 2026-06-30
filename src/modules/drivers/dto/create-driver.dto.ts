// src/modules/drivers/dto/create-driver.dto.ts
import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  MinLength,
  Matches,
} from 'class-validator';
import { VehicleType } from '@common/enums';

export class CreateDriverDto {
  @IsString()
  name: string;

  @IsString()
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'رقم الهاتف غير صحيح' })
  phone: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  nationalId: string;

  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @IsString()
  vehiclePlate: string;

  // بيانات الـ account للتطبيق
  @IsString()
  @MinLength(8)
  password: string;
}
