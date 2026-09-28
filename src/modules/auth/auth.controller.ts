import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { GetCurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';
import { AuthThrottle } from '@common/decorators/throttle.decorator';
import {
  ApiSuccessResponse,
  ApiCommonResponses,
} from '@common/swagger/api-responses.decorator';

@ApiTags('Authentication')
@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @Public()
  @AuthThrottle()
  @ApiOperation({
    summary: 'Sign in',
    description: 'Returns JWT tokens for accessing the API',
  })
  @ApiBody({ type: LoginDto })
  @ApiSuccessResponse('Signed in successfully')
  @ApiCommonResponses()
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('refresh')
  @Public()
  @ApiOperation({ summary: 'Refresh the access token' })
  @ApiCommonResponses()
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @Get('me')
  @ApiOperation({ summary: 'Current user details' })
  @ApiBearerAuth('JWT')
  @ApiSuccessResponse('User details')
  @ApiCommonResponses()
  me(@GetCurrentUser('id') userId: string) {
    return this.authService.me(userId);
  }
}
