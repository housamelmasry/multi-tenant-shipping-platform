// src/common/enums/return-reason.enum.ts
export const ReturnReason = {
  CUSTOMER_REFUSED: 'customer_refused', // رفض العميل
  WRONG_ITEM: 'wrong_item', // منتج خاطئ
  DAMAGED_ITEM: 'damaged_item', // منتج تالف
  CUSTOMER_REQUESTED: 'customer_requested', // طلب العميل الإرجاع
  MAX_ATTEMPTS: 'max_attempts', // تجاوز عدد المحاولات
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
