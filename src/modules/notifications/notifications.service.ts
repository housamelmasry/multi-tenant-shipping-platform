// src/modules/notifications/notifications.service.ts
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '@database/database.service';
import { NotificationType, NotificationMeta } from '@common/enums';
import {
  initializeFirebase,
  getFirebaseMessaging,
} from '@config/firebase.config';
import { SendAnnouncementDto } from './dto/send-announcement.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private db: DatabaseService,
    private config: ConfigService,
  ) {}

  onModuleInit() {
    initializeFirebase(this.config);
  }

  // ─── FCM Token Management ─────────────────────────────

  async updateFcmToken(driverId: string, fcmToken: string) {
    await this.db.driver.update({
      where: { id: driverId },
      data: {
        fcmToken,
        fcmTokenAt: new Date(),
      },
    });

    return { message: 'تم تحديث رمز الإشعارات بنجاح' };
  }

  // ─── Core Send Method ─────────────────────────────────

  async sendToDriver(params: {
    driverId: string;
    tenantId: string;
    type: NotificationType;
    data?: Record<string, string>;
    lang?: string;
  }) {
    const { driverId, tenantId, type, data = {}, lang = 'ar' } = params;

    // جلب الـ FCM token
    const driver = await this.db.driver.findUnique({
      where: { id: driverId },
      select: { fcmToken: true, fcmTokenAt: true, name: true },
    });

    // إنشاء الـ notification record
    const title = NotificationMeta.title(type, lang);
    const body = this.buildNotificationBody(type, data, lang);

    const notification = await this.db.notification.create({
      data: {
        tenantId,
        driverId,
        type,
        title,
        body,
        data,
        status: 'PENDING',
      },
    });

    // لو مفيش token → فشل هادئ
    if (!driver?.fcmToken) {
      await this.db.notification.update({
        where: { id: notification.id },
        data: { status: 'FAILED' },
      });

      this.logger.warn(`Driver ${driverId} has no FCM token`);
      return { sent: false, reason: 'no_fcm_token' };
    }

    // إرسال FCM
    try {
      await getFirebaseMessaging().send({
        token: driver.fcmToken,
        notification: { title, body },
        data: {
          type,
          notificationId: notification.id,
          ...data,
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'orders',
            priority: 'high',
            visibility: 'public',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
              'content-available': 1,
            },
          },
        },
      });

      // ✅ نجح
      await this.db.notification.update({
        where: { id: notification.id },
        data: { status: 'SENT', sentAt: new Date() },
      });

      this.logger.log(`✅ Notification sent to ${driver.name} — ${type}`);
      return { sent: true, notificationId: notification.id };
    } catch (error) {
      // ❌ فشل
      await this.db.notification.update({
        where: { id: notification.id },
        data: { status: 'FAILED' },
      });

      // لو الـ token منتهي الصلاحية → امسحه
      if (
        error.code === 'messaging/registration-token-not-registered' ||
        error.code === 'messaging/invalid-registration-token'
      ) {
        await this.db.driver.update({
          where: { id: driverId },
          data: { fcmToken: null, fcmTokenAt: null },
        });
        this.logger.warn(`Removed invalid FCM token for driver ${driverId}`);
      }

      this.logger.error(`❌ FCM failed for ${driverId}: ${error.message}`);
      return { sent: false, reason: error.code };
    }
  }

  // ─── Specific Notification Types ─────────────────────

  async notifyNewOrder(
    driverId: string,
    tenantId: string,
    order: {
      id: string;
      trackingCode: string;
      recipientAddress: string;
    },
  ) {
    return this.sendToDriver({
      driverId,
      tenantId,
      type: NotificationType.NEW_ORDER,
      data: {
        orderId: order.id,
        trackingCode: order.trackingCode,
        address: order.recipientAddress,
      },
    });
  }

  async notifyNewReturn(
    driverId: string,
    tenantId: string,
    returnRequest: {
      id: string;
      warehouseAddress: string;
      orderId: string;
    },
  ) {
    return this.sendToDriver({
      driverId,
      tenantId,
      type: NotificationType.NEW_RETURN,
      data: {
        returnId: returnRequest.id,
        orderId: returnRequest.orderId,
        warehouseAddress: returnRequest.warehouseAddress,
      },
    });
  }

  async notifyOrderCancelled(
    driverId: string,
    tenantId: string,
    order: {
      id: string;
      trackingCode: string;
    },
  ) {
    return this.sendToDriver({
      driverId,
      tenantId,
      type: NotificationType.ORDER_CANCELLED,
      data: {
        orderId: order.id,
        trackingCode: order.trackingCode,
      },
    });
  }

  // ─── Announcement لكل السائقين ────────────────────────

  async sendAnnouncement(tenantId: string, dto: SendAnnouncementDto) {
    // جلب السائقين المستهدفين
    const drivers = await this.db.driver.findMany({
      where: {
        tenantId,
        isActive: true,
        fcmToken: { not: null },
        ...(dto.driverIds?.length && {
          id: { in: dto.driverIds },
        }),
      },
      select: { id: true, fcmToken: true, name: true },
    });

    if (drivers.length === 0) {
      return { sent: 0, message: 'لا يوجد سائقون لإرسال الإشعار إليهم' };
    }

    // Multicast — إرسال لمجموعة دفعة واحدة (أكفأ)
    const tokens = drivers.map((d) => d.fcmToken!);

    const response = await getFirebaseMessaging().sendEachForMulticast({
      tokens,
      notification: { title: dto.title, body: dto.body },
      data: { type: NotificationType.ANNOUNCEMENT },
      android: { priority: 'high' },
    });

    // تسجيل في DB
    await this.db.notification.createMany({
      data: drivers.map((driver) => ({
        tenantId,
        driverId: driver.id,
        type: NotificationType.ANNOUNCEMENT,
        title: dto.title,
        body: dto.body,
        status: 'SENT',
        sentAt: new Date(),
      })),
    });

    this.logger.log(
      `Announcement sent: ${response.successCount} success, ${response.failureCount} failed`,
    );

    return {
      total: drivers.length,
      sent: response.successCount,
      failed: response.failureCount,
    };
  }

  // ─── Driver Notifications History ────────────────────

  async getMyNotifications(driverId: string, query: QueryNotificationsDto) {
    const { status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [notifications, total, unreadCount] = await Promise.all([
      this.db.notification.findMany({
        where: {
          driverId,
          ...(status && { status }),
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          data: true,
          status: true,
          sentAt: true,
          readAt: true,
          createdAt: true,
        },
      }),
      this.db.notification.count({ where: { driverId } }),
      this.db.notification.count({
        where: { driverId, status: 'SENT' }, // SENT = لم يُقرأ بعد
      }),
    ]);

    return {
      data: notifications,
      meta: { total, page, limit, unreadCount },
    };
  }

  async markAsRead(notificationId: string, driverId: string) {
    await this.db.notification.updateMany({
      where: { id: notificationId, driverId },
      data: { status: 'READ', readAt: new Date() },
    });

    return { message: 'تم التحديث' };
  }

  async markAllAsRead(driverId: string) {
    await this.db.notification.updateMany({
      where: { driverId, status: 'SENT' },
      data: { status: 'READ', readAt: new Date() },
    });

    return { message: 'تم تحديد الكل كمقروء' };
  }

  // ─── Private ──────────────────────────────────────────

  private buildNotificationBody(
    type: NotificationType,
    data: Record<string, string>,
    lang = 'ar',
  ): string {
    const bodies: Record<string, Record<NotificationType, string>> = {
      ar: {
        new_order: `طلب جديد — ${data.trackingCode ?? ''} — ${data.address ?? ''}`,
        new_return: `طلب إرجاع — يرجى التوجه إلى ${data.warehouseAddress ?? ''}`,
        order_cancelled: `تم إلغاء الطلب ${data.trackingCode ?? ''}`,
        reminder: `لديك طلب معلق منذ فترة — ${data.trackingCode ?? ''}`,
        announcement: data.body ?? '',
      },
      en: {
        new_order: `New order — ${data.trackingCode ?? ''} — ${data.address ?? ''}`,
        new_return: `Return request — go to ${data.warehouseAddress ?? ''}`,
        order_cancelled: `Order ${data.trackingCode ?? ''} was cancelled`,
        reminder: `You have a pending order — ${data.trackingCode ?? ''}`,
        announcement: data.body ?? '',
      },
    };

    return bodies[lang]?.[type] ?? bodies['ar'][type];
  }
}
