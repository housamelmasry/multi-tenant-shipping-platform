import { IsString } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  orderId: string;

  @IsString()
  otp: string;
}
