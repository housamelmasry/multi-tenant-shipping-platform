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

const REASON_LABEL_KEYS: Record<ReturnReason, string> = {
  customer_refused: 'errors.return_reason.customer_refused',
  wrong_item: 'errors.return_reason.wrong_item',
  damaged_item: 'errors.return_reason.damaged_item',
  customer_requested: 'errors.return_reason.customer_requested',
  max_attempts: 'errors.return_reason.max_attempts',
  other: 'errors.return_reason.other',
};

export const ReturnReasonMeta = {
  /**
   * i18n key for the reason's display label. Pass the result to
   * I18nHelper.translate() rather than rendering it directly.
   */
  labelKey: (reason: ReturnReason): string =>
    REASON_LABEL_KEYS[reason] ?? `errors.return_reason.${reason}`,
};
