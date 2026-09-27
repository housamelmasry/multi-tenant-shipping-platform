// src/modules/tenants/dto/regenerate-api-key.dto.ts
import { IsString, MinLength } from 'class-validator';

export class RegenerateApiKeyDto {
  // Confirm the password before regenerating the API key.
  @IsString()
  @MinLength(6)
  password: string;
}
