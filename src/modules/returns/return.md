# Tenant
POST   /api/v1/returns              → إنشاء طلب إرجاع
GET    /api/v1/returns              → كل طلبات الإرجاع
GET    /api/v1/returns/:id          → تفاصيل طلب
POST   /api/v1/returns/:id/assign   → تعيين سائق
PATCH  /api/v1/returns/:id/cancel   → إلغاء

# Driver
PATCH  /api/v1/returns/:id/status       → تحديث الحالة
POST   /api/v1/returns/:id/otp/send     → OTP للمستودع
POST   /api/v1/returns/:id/otp/verify   → تأكيد + صورة المنتج





السيناريو 1 — العميل رفض:
السائق عنده → يفتح التطبيق → رفض الاستلام
                    │
                    ▼
         PATCH /orders/:id/status
         { status: 'failed', failedReason: 'customer_refused' }
                    │
                    ▼
         الشركة تقرر الإرجاع
         POST /returns
         { orderId, reason: 'customer_refused', warehouse: {...} }
                    │
                    ▼
         ReturnRequest (PENDING)
         Order (RETURNED)

─────────────────────────────────────────────

السيناريو 2 — بعد الموافقة:
Admin → POST /returns/:id/assign → { driverId }
                    │
                    ▼
         ReturnRequest (ASSIGNED)
         Driver (BUSY)
                    │
Driver App → PATCH /returns/:id/status → { status: 'picked_up' }
                    │
                    ▼
         ReturnRequest (PICKED_UP)
                    │
Driver App → PATCH /returns/:id/status → { status: 'in_transit' }
                    │
                    ▼
Driver App → POST /returns/:id/otp/send
         SMS → موظف المستودع: "رمز الاستلام: 123456"
                    │
                    ▼
Driver App → POST /returns/:id/otp/verify + صورة المنتج
                    │
                    ▼
         ReturnRequest (RETURNED ✅)
         Driver (AVAILABLE)
         Webhook → الشركة