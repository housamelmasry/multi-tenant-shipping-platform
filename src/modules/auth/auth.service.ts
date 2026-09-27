// src/modules/auth/auth.service.ts
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '@database/database.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from '@common/types/jwt-payload.type';
import { I18nHelper } from '@i18n/i18n.utils';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private db: DatabaseService,
    private jwt: JwtService,
    private readonly i18n: I18nHelper,
  ) {}

  async login(dto: LoginDto) {
    // 1. Find the user.
    const user = await this.db.user.findUnique({
      where: { email: dto.email },
      include: { tenant: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        this.i18n.t('errors.auth.invalid_credentials'),
      );
    }

    // 2. Verify the password.
    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException(
        this.i18n.t('errors.auth.invalid_credentials'),
      );
    }

    // 3. Generate the tokens.
    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenant: user.tenant
          ? { id: user.tenant.id, name: user.tenant.name }
          : null,
      },
      ...tokens,
    };
  }

  async refreshToken(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException(this.i18n.t('errors.auth.unauthorized'));
    }

    return this.generateTokens(user);
  }

  async me(userId: string) {
    return this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        tenant: {
          select: { id: true, name: true, plan: true },
        },
      },
    });
  }

  // Private
  private async generateTokens(user: any) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, { expiresIn: '15m' }),
      this.jwt.signAsync(payload, { expiresIn: '7d' }),
    ]);

    return { accessToken, refreshToken };
  }
}
