// src/modules/notifications/dto/send-announcement.dto.ts
import { IsString, IsArray, IsOptional, IsUUID } from 'class-validator';

export class SendAnnouncementDto {
  @IsString()
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  driverIds?: string[]; // فارغ = كل السائقين
}
