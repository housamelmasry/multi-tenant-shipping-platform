import { OrderStatus } from './order-status.enum';

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.ASSIGNED, OrderStatus.CANCELLED],
  [OrderStatus.ASSIGNED]: [OrderStatus.PICKED_UP, OrderStatus.CANCELLED],
  [OrderStatus.PICKED_UP]: [OrderStatus.IN_TRANSIT],
  [OrderStatus.IN_TRANSIT]: [OrderStatus.DELIVERED, OrderStatus.FAILED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.FAILED]: [],
  [OrderStatus.RETURNED]: [],
  [OrderStatus.CANCELLED]: [],
};

/** i18n key for this status' display label, e.g. `errors.order_status.pending`. */
const LABEL_KEYS: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: 'errors.order_status.pending',
  [OrderStatus.ASSIGNED]: 'errors.order_status.assigned',
  [OrderStatus.PICKED_UP]: 'errors.order_status.picked_up',
  [OrderStatus.IN_TRANSIT]: 'errors.order_status.in_transit',
  [OrderStatus.DELIVERED]: 'errors.order_status.delivered',
  [OrderStatus.FAILED]: 'errors.order_status.failed',
  [OrderStatus.RETURNED]: 'errors.order_status.returned',
  [OrderStatus.CANCELLED]: 'errors.order_status.cancelled',
};

const FINAL_STATUSES: OrderStatus[] = [
  OrderStatus.DELIVERED,
  OrderStatus.FAILED,
  OrderStatus.RETURNED,
  OrderStatus.CANCELLED,
];

export class OrderStatusMeta {
  static allowedTransitions(from: OrderStatus): OrderStatus[] {
    return TRANSITIONS[from] ?? [];
  }

  /**
   * i18n key for the status label. Pass the result to I18nHelper.translate()
   * rather than rendering it directly.
   */
  static labelKey(status: OrderStatus): string {
    return LABEL_KEYS[status] ?? `errors.order_status.${status}`;
  }

  static isFinal(status: OrderStatus): boolean {
    return FINAL_STATUSES.includes(status);
  }
}
