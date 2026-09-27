// src/common/enums/return-reason.enum.ts
export const ReturnReason = {
  CUSTOMER_REFUSED: 'customer_refused', // Refused by the customer
  WRONG_ITEM: 'wrong_item', // Incorrect item
  DAMAGED_ITEM: 'damaged_item', // Damaged item
  CUSTOMER_REQUESTED: 'customer_requested', // Return requested by the customer
  MAX_ATTEMPTS: 'max_attempts', // Maximum number of attempts exceeded
  OTHER: 'other',
} as const;

export type ReturnReason = (typeof ReturnReason)[keyof typeof ReturnReason];

export const ReturnReasonMeta = {
  label: (reason: ReturnReason): string =>
    ({
      customer_refused: 'رفض العميل الاستلام',
      wrong_item: 'منتج خاطئ',
      damaged_item: 'منتج تالف',
      customer_requested: 'طلب العميل الإرجاع',
      max_attempts: 'تجاوز عدد محاولات التسليم',
      other: 'سبب آخر',
    })[reason],
};
