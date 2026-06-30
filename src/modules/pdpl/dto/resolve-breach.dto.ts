import { IsOptional, IsString } from 'class-validator';

export class ResolveBreachDto {
  @IsOptional()
  actions?: Record<string, any>;

  @IsOptional()
  @IsString()
  notes?: string;
}
