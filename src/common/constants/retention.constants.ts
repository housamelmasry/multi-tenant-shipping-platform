// src/common/constants/retention.constants.ts

export const RETENTION_POLICY = {
  // بيانات الطلبات
  orders: {
    completedDays: 365 * 3, // 3 سنوات للطلبات المكتملة
    cancelledDays: 365, // سنة للملغية
    anonymizeAfter: 365 * 5, // إخفاء الهوية بعد 5 سنوات
  },

  // بيانات السائقين
  drivers: {
    activeDays: -1, // طول فترة العمل
    terminatedDays: 365 * 2, // سنتين بعد انتهاء العقد
  },

  // صور التسليم
  photos: {
    deliveryDays: 365, // سنة
    returnDays: 365, // سنة
  },

  // سجلات الـ SMS
  smsLogs: {
    retentionDays: 90, // 90 يوم
  },

  // سجلات الـ Webhooks
  webhookLogs: {
    retentionDays: 30, // 30 يوم
  },

  // سجلات الوصول
  accessLogs: {
    retentionDays: 365, // سنة
  },
} as const;
