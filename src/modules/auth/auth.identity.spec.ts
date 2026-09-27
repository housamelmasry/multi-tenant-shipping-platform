import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

describe('authentication identity', () => {
  it('uses the database user ID for /me and the supplied refresh token', async () => {
    const authService = {
      me: jest.fn().mockResolvedValue({ id: 'user-1' }),
      refreshToken: jest.fn().mockResolvedValue({ accessToken: 'access' }),
    };
    const controller = new AuthController(authService as unknown as AuthService);

    await controller.me('user-1');
    await controller.refresh({ refreshToken: 'refresh-token' });

    expect(authService.me).toHaveBeenCalledWith('user-1');
    expect(authService.refreshToken).toHaveBeenCalledWith('refresh-token');
  });

  it('rejects access tokens on the refresh path', async () => {
    const db = { user: { findUnique: jest.fn() } };
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-1', tokenType: 'access' }),
      signAsync: jest.fn(),
    };
    const service = new AuthService(
      db as never,
      jwt as never,
      { t: (key: string) => key } as never,
    );

    await expect(service.refreshToken('access-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it('attaches the linked driver record ID to the authenticated user', async () => {
    const db = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'driver@example.invalid',
          role: 'TENANT_STAFF',
          tenantId: 'tenant-1',
          isActive: true,
          driverId: 'driver-1',
          driver: { isActive: true },
          tenant: { isActive: true },
        }),
      },
    };
    const strategy = new JwtStrategy(
      { get: () => 'test-secret' } as never,
      db as never,
      { t: (key: string) => key } as never,
    );

    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'driver@example.invalid',
        role: 'TENANT_STAFF',
        tenantId: 'tenant-1',
      }),
    ).resolves.toMatchObject({ id: 'user-1', driverId: 'driver-1' });
  });

  it('rejects an inactive linked driver even if the user account is active', async () => {
    const db = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'driver@example.invalid',
          role: 'TENANT_STAFF',
          tenantId: 'tenant-1',
          isActive: true,
          driverId: 'driver-1',
          driver: { isActive: false },
          tenant: { isActive: true },
        }),
      },
    };
    const strategy = new JwtStrategy(
      { get: () => 'test-secret' } as never,
      db as never,
      { t: (key: string) => key } as never,
    );

    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'driver@example.invalid',
        role: 'TENANT_STAFF',
        tenantId: 'tenant-1',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});