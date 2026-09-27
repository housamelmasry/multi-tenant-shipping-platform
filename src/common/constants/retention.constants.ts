// src/common/constants/retention.constants.ts

export const RETENTION_POLICY = {
  // Order data
  orders: {
    completedDays: 365 * 3, // 3 years for completed orders
    cancelledDays: 365, // 1 year for canceled orders
    anonymizeAfter: 365 * 5, // Anonymize after 5 years
  },

  // Driver data
  drivers: {
    activeDays: -1, // For the duration of employment
    terminatedDays: 365 * 2, // 2 years after termination
  },

  // Delivery photos
  photos: {
    deliveryDays: 365, // 1 year
    returnDays: 365, // 1 year
  },

  // SMS logs
  smsLogs: {
    retentionDays: 90, // 90 days
  },

  // Webhook logs
  webhookLogs: {
    retentionDays: 30, // 30 days
  },

  // Access logs
  accessLogs: {
    retentionDays: 365, // 1 year
  },
} as const;
