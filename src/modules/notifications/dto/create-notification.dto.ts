import { IsString, IsOptional, IsObject } from 'class-validator';

export class CreateNotificationDto {
  @IsString()
  driverId: string;

  @IsString()
  type: string;

  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;
}
