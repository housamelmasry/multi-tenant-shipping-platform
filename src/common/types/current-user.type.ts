// src/common/types/current-user.type.ts
export type CurrentUser = {
  id: string;
  email: string;
  role: string;
  tenantId: string | null;
};
