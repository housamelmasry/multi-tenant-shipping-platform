// src/common/enums/return-status.enum.ts
export const ReturnStatus = {
  PENDING: 'pending', // بانتظار تعيين سائق
  ASSIGNED: 'assigned', // تم تعيين سائق
  PICKED_UP: 'picked_up', // السائق استلم من العميل
  IN_TRANSIT: 'in_transit', // في الطريق للمستودع
  RETURNED: 'returned', // تم التسليم للمستودع ✅
  CANCELLED: 'cancelled', // ملغي
} as const;

export type ReturnStatus = (typeof ReturnStatus)[keyof typeof ReturnStatus];

export const ReturnStatusMeta = {
  label: (status: ReturnStatus): string =>
    ({
      pending: 'بانتظار السائق',
      assigned: 'تم التعيين',
      picked_up: 'تم الاستلام من العميل',
      in_transit: 'في الطريق للمستودع',
      returned: 'تم الإرجاع للمستودع',
      cancelled: 'ملغي',
    })[status],

  allowedTransitions: (status: ReturnStatus): ReturnStatus[] =>
    ({
      pending: [ReturnStatus.ASSIGNED, ReturnStatus.CANCELLED],
      assigned: [ReturnStatus.PICKED_UP, ReturnStatus.CANCELLED],
      picked_up: [ReturnStatus.IN_TRANSIT],
      in_transit: [ReturnStatus.RETURNED],
      returned: [],
      cancelled: [],
    })[status],

  isFinal: (status: ReturnStatus): boolean =>
    ([ReturnStatus.RETURNED, ReturnStatus.CANCELLED] as ReturnStatus[]).includes(status),
};
