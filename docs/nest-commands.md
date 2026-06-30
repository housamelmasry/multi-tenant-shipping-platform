# إنشاء وحدة الإشعارات (Notifications Module)

```bash
# 1. إنشاء الموديول
nest g module modules/notifications --no-spec

# 2. إنشاء الكونترولر
nest g controller modules/notifications --no-spec

# 3. إنشاء الخدمة
nest g service modules/notifications --no-spec

# 4. إنشاء DTOs
nest g class modules/notifications/dto/register-device.dto --no-spec
nest g class modules/notifications/dto/create-notification.dto --no-spec
nest g class modules/notifications/dto/query-notifications.dto --no-spec
```

## بعد الإنشاء

- تسجيل `NotificationsModule` في `app.module.ts` يتم تلقائياً
- إضافة مسار `PATCH /drivers/me/device` في `DriversController` لتسجيل FCM token
- إنشاء جدول `notifications` مسبقاً في Prisma schema (تم)
