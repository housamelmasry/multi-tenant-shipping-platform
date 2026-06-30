// src/modules/orders/dto/verify-otp.dto.ts
import { IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @Length(6, 6)
  code: string;
}
