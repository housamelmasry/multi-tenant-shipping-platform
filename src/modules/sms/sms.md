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
= "Hello Demo Recipient,
Your delivery confirmation code for order SHP-DEMO0001 is:
000000
Valid for 10 minutes
Demo Store"
│
▼
normalizePhone('+966500000001')
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
"000000"
│
▼
السائق يدخل الرمز → تم التسليم ✅
