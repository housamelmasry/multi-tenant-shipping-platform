import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'manager@demo.invalid',
    description: 'Email address',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'your-password',
    description: 'Password (at least 8 characters)',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;
}
