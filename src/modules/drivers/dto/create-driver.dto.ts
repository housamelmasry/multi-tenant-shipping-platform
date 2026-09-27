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
  @ApiProperty({ example: 'Demo Driver' })
  @IsString()
  name: string;

  @ApiProperty({ example: '+966500000001' })
  @IsString()
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'رقم الهاتف غير صحيح' })
  phone: string;

  @ApiPropertyOptional({ example: 'driver@example.invalid' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: '0000000001', description: 'رقم الهوية الوطنية' })
  @IsString()
  nationalId: string;

  @ApiProperty({
    example: 'motorcycle',
    enum: ['motorcycle', 'car', 'van', 'truck'],
  })
  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @ApiProperty({ example: 'DEMO-0001' })
  @IsString()
  vehiclePlate: string;

  @ApiProperty({ example: 'your-password', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}
