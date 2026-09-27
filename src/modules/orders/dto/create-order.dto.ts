import {
  IsString,
  IsOptional,
  IsNumber,
  Min,
  ValidateNested,
  IsLatitude,
  IsLongitude,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class AddressDto {
  @ApiProperty({ example: 'Demo Store' })
  @IsString()
  name: string;

  @ApiProperty({ example: '+966500000011' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 'Demo address, Riyadh' })
  @IsString()
  address: string;

  @ApiPropertyOptional({ example: 24.7136, description: 'خط العرض' })
  @IsOptional()
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({ example: 46.6753, description: 'خط الطول' })
  @IsOptional()
  @IsLongitude()
  lng?: number;
}

export class CreateOrderDto {
  @ApiProperty({ type: AddressDto, description: 'بيانات المرسل' })
  @ValidateNested()
  @Type(() => AddressDto)
  sender: AddressDto;

  @ApiProperty({ type: AddressDto, description: 'بيانات المستلم' })
  @ValidateNested()
  @Type(() => AddressDto)
  recipient: AddressDto;

  @ApiPropertyOptional({ example: 'Demo package' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 2.5, description: 'الوزن بالكيلوجرام' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @ApiPropertyOptional({
    example: 150.0,
    description: 'مبلغ الدفع عند الاستلام',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  codAmount?: number;

  @ApiPropertyOptional({ example: 'Demo delivery note' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    example: 'ORD-12345',
    description: 'رقم الطلب في نظام الشركة',
  })
  @IsOptional()
  @IsString()
  externalRef?: string;
}

export class OrderResponseDto {
  @ApiProperty({ example: 'uuid' })
  id: string;

  @ApiProperty({ example: 'SHP-A3F92B1C' })
  trackingCode: string;

  @ApiProperty({
    example: 'pending',
    enum: [
      'pending',
      'assigned',
      'picked_up',
      'in_transit',
      'delivered',
      'failed',
      'returned',
      'cancelled',
    ],
  })
  status: string;

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  createdAt: Date;
}
