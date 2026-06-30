// src/modules/notifications/dto/update-fcm-token.dto.ts
import { IsString, MinLength } from 'class-validator';

export class UpdateFcmTokenDto {
  @IsString()
  @MinLength(10)
  fcmToken: string;
}
