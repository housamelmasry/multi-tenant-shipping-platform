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