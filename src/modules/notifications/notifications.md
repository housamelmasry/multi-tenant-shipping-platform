# Driver App
POST  /api/v1/notifications/fcm-token     → تحديث الـ token عند login
GET   /api/v1/notifications/my            → سجل الإشعارات
PATCH /api/v1/notifications/mark-all-read → تحديد الكل كمقروء
PATCH /api/v1/notifications/:id/read      → تحديد واحد كمقروء

# Admin
POST  /api/v1/notifications/announcement  → إشعار لكل السائقين



autoAssign() ينجح
      │
      ▼
notifyNewOrder(driverId, ...)
      │
      ▼
FCM token موجود؟
  ├── لأ → log warning + status: FAILED
  └── أيوه →
        │
        ▼
   Firebase.send()
        │
   ┌────┴────┐
   ✅ نجح    ❌ فشل
   │         │
   SENT    token منتهي؟
            ├── أيوه → امسح الـ token
            └── لأ  → FAILED
        │
        ▼
   Driver Phone
   🔔 "طلب توصيل جديد 🚚
       SHP-A3F92B1C
       شارع الملك فهد"