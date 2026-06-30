import { OrderStatus } from './order-status.enum';

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.ASSIGNED, OrderStatus.CANCELLED],
  [OrderStatus.ASSIGNED]: [OrderStatus.PICKED_UP, OrderStatus.CANCELLED],
  [OrderStatus.PICKED_UP]: [OrderStatus.IN_TRANSIT],
  [OrderStatus.IN_TRANSIT]: [OrderStatus.DELIVERED, OrderStatus.FAILED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.FAILED]: [],
  [OrderStatus.CANCELLED]: [],
};

const LABELS: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: 'قيد الانتظار',
  [OrderStatus.ASSIGNED]: 'تم التعيين',
  [OrderStatus.PICKED_UP]: 'تم الاستلام',
  [OrderStatus.IN_TRANSIT]: 'قيد التوصيل',
  [OrderStatus.DELIVERED]: 'تم التوصيل',
  [OrderStatus.FAILED]: 'فشل التوصيل',
  [OrderStatus.CANCELLED]: 'ملغي',
};

const FINAL_STATUSES: OrderStatus[] = [
  OrderStatus.DELIVERED,
  OrderStatus.FAILED,
  OrderStatus.CANCELLED,
];

export class OrderStatusMeta {
  static allowedTransitions(from: OrderStatus): OrderStatus[] {
    return TRANSITIONS[from] ?? [];
  }

  static label(status: OrderStatus): string {
    return LABELS[status] ?? status;
  }

  static isFinal(status: OrderStatus): boolean {
    return FINAL_STATUSES.includes(status);
  }
}
