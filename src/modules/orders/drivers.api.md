# Tenant Admin
POST   /api/v1/drivers              → إضافة سائق
GET    /api/v1/drivers              → كل السائقين
GET    /api/v1/drivers/:id          → تفاصيل سائق
PATCH  /api/v1/drivers/:id          → تعديل سائق
PATCH  /api/v1/drivers/:id/toggle   → تفعيل/تعطيل

# Driver App
PATCH  /api/v1/drivers/me/location  → تحديث الموقع
PATCH  /api/v1/drivers/me/online    → أنا متاح
PATCH  /api/v1/drivers/me/offline   → أنا غير متاح
GET    /api/v1/drivers/me/stats     → إحصائياتي