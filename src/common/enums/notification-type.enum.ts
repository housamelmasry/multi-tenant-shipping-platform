// src/common/enums/notification-type.enum.ts
export const NotificationType = {
  NEW_ORDER: 'new_order',
  NEW_RETURN: 'new_return',
  ORDER_CANCELLED: 'order_cancelled',
  REMINDER: 'reminder',
  ANNOUNCEMENT: 'announcement',
} as const;

export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];

export const NotificationMeta = {
  title: (type: NotificationType, lang = 'ar'): string => {
    const titles: Record<string, Record<NotificationType, string>> = {
      ar: {
        new_order: 'طلب توصيل جديد 🚚',
        new_return: 'طلب إرجاع جديد 📦',
        order_cancelled: 'تم إلغاء الطلب',
        reminder: 'تذكير بطلب معلق ⏰',
        announcement: 'إشعار من الإدارة 📢',
      },
      en: {
        new_order: 'New Delivery Order 🚚',
        new_return: 'New Return Request 📦',
        order_cancelled: 'Order Cancelled',
        reminder: 'Pending Order Reminder ⏰',
        announcement: 'Admin Announcement 📢',
      },
    };
    return titles[lang]?.[type] ?? titles['ar'][type];
  },
};
