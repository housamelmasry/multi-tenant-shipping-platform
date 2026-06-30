import { IsString, IsOptional } from 'class-validator';

export class RegisterDeviceDto {
  @IsString()
  fcmToken: string;
}
