// src/common/enums/return-status.enum.ts
export const ReturnStatus = {
  PENDING: 'pending', // Waiting for driver assignment
  ASSIGNED: 'assigned', // Driver assigned
  PICKED_UP: 'picked_up', // Picked up from the customer
  IN_TRANSIT: 'in_transit', // In transit to the warehouse
  RETURNED: 'returned', // Delivered to the warehouse ✅
  CANCELLED: 'cancelled', // Canceled
} as const;

export type ReturnStatus = (typeof ReturnStatus)[keyof typeof ReturnStatus];

export const ReturnStatusMeta = {
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
    (
      [ReturnStatus.RETURNED, ReturnStatus.CANCELLED] as ReturnStatus[]
    ).includes(status),
};
