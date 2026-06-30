import { IsString, IsOptional } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  pickupAddress: string;

  @IsString()
  deliveryAddress: string;

  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
