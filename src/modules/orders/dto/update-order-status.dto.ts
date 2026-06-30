// src/modules/orders/dto/update-order-status.dto.ts
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { OrderStatus } from '@common/enums';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status: OrderStatus;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  failedReason?: string;
}
