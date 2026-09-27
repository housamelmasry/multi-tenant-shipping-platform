import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'manager@demo.invalid',
    description: 'البريد الإلكتروني',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'your-password',
    description: 'كلمة المرور (8 أحرف على الأقل)',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;
}
