// src/modules/auth/auth.controller.ts
import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { GetCurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';

@Controller('auth')
@UseGuards(JwtAuthGuard) // كل الـ routes محتاجة auth
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @Public() // ما عداها
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @Public()
  refresh(@GetCurrentUser('sub') userId: string) {
    return this.authService.refreshToken(userId);
  }

  @Get('me')
  me(@GetCurrentUser('sub') userId: string) {
    return this.authService.me(userId);
  }
}
