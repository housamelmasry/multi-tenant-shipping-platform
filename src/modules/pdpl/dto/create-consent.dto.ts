import {
  IsString, IsOptional, IsUUID, IsPhoneNumber,
  IsIP, IsBoolean,
} from 'class-validator';

export class CreateConsentDto {
  @IsUUID()
  tenantId: string;

  @IsString()
  entityType: 'customer' | 'driver';

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsPhoneNumber()
  phone: string;

  @IsString()
  purpose: 'delivery' | 'marketing';

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsIP()
  ipAddress?: string;
}
