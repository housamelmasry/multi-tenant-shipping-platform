# Public
POST /api/v1/pdpl/consent          → تسجيل موافقة
POST /api/v1/pdpl/consent/revoke   → سحب موافقة

# Tenant Admin
POST /api/v1/pdpl/data-requests         → طلب وصول/حذف
GET  /api/v1/pdpl/data-requests         → كل الطلبات
POST /api/v1/pdpl/data-requests/:id/report → توليد التقرير
POST /api/v1/pdpl/erase/customer        → حذف بيانات عميل
POST /api/v1/pdpl/erase/driver/:id      → حذف بيانات سائق

# Super Admin
POST /api/v1/pdpl/breach               → تسجيل اختراق


✅ المتطلب                  الحالة
─────────────────────────────────────────────
الموافقة الصريحة           ConsentLog table
حق الاطلاع                 generateDataReport()
حق التصحيح                 DataRequest (RECTIFICATION)
حق الحذف                   anonymizeCustomerData()
مدة الاحتفاظ               RETENTION_POLICY + Cron
تأمين البيانات             PrivacyInterceptor + maskFields
سجل الوصول                DataAccessLog table
إشعار الاختراق             BreachLog + notifySdaia()
نقل البيانات               DataRequest (PORTABILITY)
إخفاء الهوية               Anonymization بدل الحذف الكامل



