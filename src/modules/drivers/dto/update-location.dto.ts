// src/modules/drivers/dto/update-location.dto.ts
import { IsLatitude, IsLongitude } from 'class-validator';

export class UpdateLocationDto {
  @IsLatitude()
  lat: number;

  @IsLongitude()
  lng: number;
}
