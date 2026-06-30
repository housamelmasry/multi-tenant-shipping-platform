import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'manager@demo-shipping.com',
    description: 'البريد الإلكتروني',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'Admin@123456',
    description: 'كلمة المرور (8 أحرف على الأقل)',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;
}
