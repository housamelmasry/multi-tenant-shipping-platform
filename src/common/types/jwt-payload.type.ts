// src/common/types/jwt-payload.type.ts
export type JwtPayload = {
  sub: string; // user id
  id?: string; // alias for user id for client/decorator consistency
  email: string;
  role: string;
  tenantId: string | null;
  driverId?: string;
  tokenType?: 'access' | 'refresh';
};

