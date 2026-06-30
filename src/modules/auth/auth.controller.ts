import {
  Controller, Post, Get, Body, UseGuards,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation,
  ApiBearerAuth, ApiBody,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { GetCurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';
import { AuthThrottle } from '@common/decorators/throttle.decorator';
import { ApiSuccessResponse, ApiCommonResponses } from '@common/swagger/api-responses.decorator';

@ApiTags('المصادقة')
@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @Public()
  @AuthThrottle()
  @ApiOperation({
    summary: 'تسجيل الدخول',
    description: 'يرجع JWT tokens للوصول إلى الـ API',
  })
  @ApiBody({ type: LoginDto })
  @ApiSuccessResponse('تم تسجيل الدخول بنجاح')
  @ApiCommonResponses()
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @Public()
  @ApiOperation({ summary: 'تجديد الـ Access Token' })
  @ApiBearerAuth('JWT')
  @ApiCommonResponses()
  refresh(@GetCurrentUser('sub') userId: string) {
    return this.authService.refreshToken(userId);
  }

  @Get('me')
  @ApiOperation({ summary: 'بيانات المستخدم الحالي' })
  @ApiBearerAuth('JWT')
  @ApiSuccessResponse('بيانات المستخدم')
  @ApiCommonResponses()
  me(@GetCurrentUser('sub') userId: string) {
    return this.authService.me(userId);
  }
}
