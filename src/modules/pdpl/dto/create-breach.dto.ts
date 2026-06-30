import {
  IsString, IsOptional, IsUUID, IsInt, MinLength, MaxLength,
} from 'class-validator';

export class CreateBreachDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsString()
  severity: 'low' | 'medium' | 'high' | 'critical';

  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  description: string;

  @IsOptional()
  @IsInt()
  affectedEntities?: number;

  @IsOptional()
  dataTypes?: string[];

  @IsOptional()
  actions?: Record<string, any>;
}
