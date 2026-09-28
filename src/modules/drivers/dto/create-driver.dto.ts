import {
  IsString,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VehicleType } from '@common/enums';
import {
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '@i18n/i18n.constants';

export class CreateDriverDto {
  @ApiProperty({ example: 'Demo Driver' })
  @IsString()
  name: string;

  // Points at the `validation.phone` catalog entry, resolved per request locale
  // by LocalizedValidationPipe.
  @ApiProperty({ example: '+966500000001' })
  @IsString()
  @Matches(/^\+?[0-9]{10,15}$/, { message: 'validation.phone' })
  phone: string;

  @ApiPropertyOptional({ example: 'driver@example.invalid' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ example: '0000000001', description: 'National ID' })
  @IsString()
  nationalId: string;

  @ApiProperty({
    example: 'motorcycle',
    enum: ['motorcycle', 'car', 'van', 'truck'],
  })
  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @ApiProperty({ example: 'DEMO-0001' })
  @IsString()
  vehiclePlate: string;

  @ApiProperty({ example: 'your-password', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  /**
   * Language the driver's notifications are sent in (FCM).
   *
   * Stored on the driver because notifications are pushed asynchronously, long
   * after the request that created the driver is gone, so there is no request
   * locale to read at send time. Defaults to the creating request's language.
   */
  @ApiPropertyOptional({ example: 'ar', enum: ['ar', 'en'] })
  @IsOptional()
  @IsIn([...SUPPORTED_LANGUAGES])
  lang?: SupportedLanguage;
}
