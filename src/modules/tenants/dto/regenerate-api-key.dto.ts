// src/modules/tenants/dto/regenerate-api-key.dto.ts
import { IsString, MinLength } from 'class-validator';

export class RegenerateApiKeyDto {
  // تأكيد الباسورد قبل إعادة توليد الـ API Key
  @IsString()
  @MinLength(6)
  password: string;
}
