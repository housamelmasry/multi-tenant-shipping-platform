// src/common/types/tenant-settings.type.ts
export type TenantSettings = {
  defaultLang: 'ar' | 'en';
  smsEnabled: boolean;
  webhookRetries: number;
};

export const defaultTenantSettings: TenantSettings = {
  defaultLang: 'ar',
  smsEnabled: true,
  webhookRetries: 3,
};
