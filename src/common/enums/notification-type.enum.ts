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
  /**
   * i18n keys for the title and body of a notification type. Pass these to
   * I18nHelper.translate() rather than rendering them directly — the
   * notification is stored in the database in the recipient's language.
   */
  keys: (type: NotificationType) => ({
    title: `notifications.title.${type}`,
    body: `notifications.body.${type}`,
  }),
};
