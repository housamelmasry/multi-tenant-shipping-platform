import { IsUUID } from 'class-validator';

export class AssignReturnDriverDto {
  @IsUUID()
  driverId: string;
}
