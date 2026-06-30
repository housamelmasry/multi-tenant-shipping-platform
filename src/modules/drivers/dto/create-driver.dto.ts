import { IsString, IsEnum, IsOptional } from 'class-validator';
import { VehicleType } from '@common/enums';

export class CreateDriverDto {
  @IsString()
  name: string;

  @IsString()
  phone: string;

  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @IsString()
  @IsOptional()
  userId?: string;
}
