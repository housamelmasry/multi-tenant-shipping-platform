# Tenant
POST   /api/v1/orders                    → إنشاء طلب
GET    /api/v1/orders                    → كل الطلبات (مع فلترة)
GET    /api/v1/orders/:id                → تفاصيل طلب
POST   /api/v1/orders/:id/assign         → تعيين سائق
PATCH  /api/v1/orders/:id/cancel         → إلغاء طلب

# Driver
PATCH  /api/v1/orders/:id/status         → تحديث الحالة
POST   /api/v1/orders/:id/otp/send       → إرسال OTP للعميل
POST   /api/v1/orders/:id/otp/verify     → التحقق + صورة التسليم

# Public
GET    /api/v1/orders/track/:code        → تتبع للعميل النهائي

POST  /api/v1/orders/:id/auto-assign       → تعيين تلقائي لطلب واحد
POST  /api/v1/orders/bulk-auto-assign      → تعيين تلقائي لكل المعلقة
GET   /api/v1/orders/:id/assignment-preview → معاينة بدون تعيين فعلي

PATCH /api/v1/tenants/me/assignment-config → تعديل إعدادات التعيين


إنشاء الطلب
     │
     ▼
PENDING ──assign──► ASSIGNED ──driver picks up──► PICKED_UP
                                                       │
                                                       ▼
                                                  IN_TRANSIT
                                                       │
                                              ┌────────┴────────┐
                                              │                 │
                                         send OTP           FAILED
                                              │                 │
                                         verify OTP         RETURNED
                                              │
                                         DELIVERED ✅
                                    (photo + timestamp)






                                    POST /orders/:id/auto-assign
          │
          ▼
    جلب الطلب والتحقق
    status = PENDING ✅
    senderLat/Lng موجود ✅
          │
          ▼
    getTenantAssignmentConfig()
    maxDistanceKm = 20
          │
          ▼
    جلب السائقين المتاحين
    ├── status = AVAILABLE
    ├── lastLocationAt < 30 دقيقة
    └── currentLat/Lng موجود
          │
          ▼
    findNearestDriver()
    ┌──────────────────────┐
    │ Driver A → 2.3 كم   │ ← الأقرب ✅
    │ Driver B → 5.1 كم   │
    │ Driver C → 12.7 كم  │
    └──────────────────────┘
          │
          ▼
    $transaction
    ├── order.status = ASSIGNED
    └── driver.status = BUSY
          │
          ▼
    ┌─────────────────────┐
    │ Webhook dispatch    │
    │ Socket.io emit      │
    │ Status History log  │
    └─────────────────────┘
          │
          ▼
    Response:
    {
      order: { ... },
      assignedDriver: {
        name: "Ahmed",
        distanceKm: 2.3
      }
    }