// src/common/types/jwt-payload.type.ts
export type JwtPayload = {
  sub: string; // user id
  email: string;
  role: string;
  tenantId: string | null;
};
