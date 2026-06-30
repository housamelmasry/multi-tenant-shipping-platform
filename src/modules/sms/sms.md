GET /api/v1/sms/stats → إحصائيات SMS للشركة
GET /api/v1/sms/logs → سجل الرسائل

السائق يضغط "تم الوصول للعميل"
│
▼
POST /orders/:id/otp/send
│
▼
SmsService.sendDeliveryOtp()
│
▼
buildMessage('otp.delivery', params, 'ar')
= "مرحباً فاطمة،
رمز تأكيد استلام طلبك (SHP-A3F9) هو:
483920
صالح لمدة 10 دقائق
متجر الرياض"
│
▼
normalizePhone('+966501234567')
│
▼
createSmsLog() → status: pending
│
▼
Unifonic API POST
│
┌────┴────┐
✅ نجح ❌ فشل
│ │
SENT FAILED
cost: 0.05 ريال
│
▼
📱 العميل يستلم SMS
"483920"
│
▼
السائق يدخل الرمز → تم التسليم ✅
