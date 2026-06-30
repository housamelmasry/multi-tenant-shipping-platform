import { IsEnum, IsString, IsOptional, IsUUID, IsPhoneNumber } from 'class-validator';

export enum DataRequestType {
  ACCESS = 'ACCESS',
  RECTIFICATION = 'RECTIFICATION',
  ERASURE = 'ERASURE',
  PORTABILITY = 'PORTABILITY',
  OBJECTION = 'OBJECTION',
}

export class CreateDataRequestDto {
  @IsUUID()
  tenantId: string;

  @IsEnum(DataRequestType)
  type: DataRequestType;

  @IsString()
  requesterType: 'customer' | 'driver' | 'regulator';

  @IsOptional()
  @IsPhoneNumber()
  phone?: string;

  @IsOptional()
  @IsUUID()
  driverId?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
