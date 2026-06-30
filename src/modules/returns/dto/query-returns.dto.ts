import { IsOptional, IsEnum, IsInt, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ReturnStatus, ReturnReason } from '@common/enums';

export class QueryReturnsDto {
  @IsOptional()
  @IsEnum(ReturnStatus)
  status?: ReturnStatus;

  @IsOptional()
  @IsEnum(ReturnReason)
  reason?: ReturnReason;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
