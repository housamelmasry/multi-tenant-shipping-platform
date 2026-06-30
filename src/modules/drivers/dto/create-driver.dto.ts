import {
  IsString,
  IsEmail,
  IsEnum,
  IsOptional,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VehicleType } from '@common/enums';

export class CreateDriverDto {
  @ApiProperty({ example: 'أحمد محمد السيد' })
  @IsString()
  name: string;

  @ApiProperty({ example: '+966501111111' })
  @IsString()
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'رقم الهاتف غير صحيح' })
  phone: string;

  @ApiPropertyOptional({ example: 'ahmed@driver.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: '1234567890', description: 'رقم الهوية الوطنية' })
  @IsString()
  nationalId: string;

  @ApiProperty({
    example: 'motorcycle',
    enum: ['motorcycle', 'car', 'van', 'truck'],
  })
  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @ApiProperty({ example: 'أ ب ج 1234' })
  @IsString()
  vehiclePlate: string;

  @ApiProperty({ example: 'Driver@123456', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}
