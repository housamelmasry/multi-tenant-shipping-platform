POST /api/v1/webhooks → إضافة webhook
GET /api/v1/webhooks → كل الـ webhooks
PATCH /api/v1/webhooks/:id/toggle → تفعيل/تعطيل
DELETE /api/v1/webhooks/:id → حذف
POST /api/v1/webhooks/:id/rotate-secret → تجديد الـ secret

GET /api/v1/webhooks/logs → سجل الإرسال
GET /api/v1/webhooks/logs/:logId → تفاصيل سجل
POST /api/v1/webhooks/logs/:logId/retry → إعادة الإرسال يدوياً

OrdersService.updateStatus()
│
▼
WebhooksService.dispatch(tenantId, 'order.delivered', order)
│
▼
DB: إيجاد كل الـ webhooks النشطة المشتركة في 'order.delivered'
│
▼
لكل webhook:
├── DB: إنشاء WebhookLog (status: pending)
└── Queue: إضافة job

        │
        ▼ (في الـ background)

WebhooksProcessor.handleSend()
├── ✅ نجح → Log (status: success)
└── ❌ فشل → Log (attempts++) → Bull retry
│
بعد 2s → محاولة 2
بعد 4s → محاولة 3
بعد 8s → محاولة 4
بعد 16s → محاولة 5
بعد 32s → Log (status: failed)
