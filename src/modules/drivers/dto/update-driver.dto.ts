import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateDriverDto } from './create-driver.dto';

// `password` is create-only: DriversService.update() forwards the DTO straight
// into `driver.update({ data: dto })`, and `Driver` has no `password` column, so
// including it turned any PATCH carrying `password` into a Prisma
// "Unknown argument" 500 (and leaked the plaintext into query logs).
export class UpdateDriverDto extends PartialType(
  OmitType(CreateDriverDto, ['password']),
) {}
