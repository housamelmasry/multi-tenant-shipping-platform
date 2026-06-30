import { IsString, Length } from 'class-validator';

export class VerifyReturnOtpDto {
  @IsString()
  @Length(6, 6)
  code: string;
}
