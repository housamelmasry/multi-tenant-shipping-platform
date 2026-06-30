POST   /api/v1/auth/login              → تسجيل دخول
GET    /api/v1/auth/me                 → بيانات المستخدم الحالي

POST   /api/v1/tenants                 → إنشاء شركة [SUPER_ADMIN]
GET    /api/v1/tenants                 → كل الشركات [SUPER_ADMIN]
GET    /api/v1/tenants/:id             → شركة محددة [SUPER_ADMIN]
PATCH  /api/v1/tenants/:id             → تعديل شركة [SUPER_ADMIN]
PATCH  /api/v1/tenants/:id/toggle-status → تفعيل/تعطيل [SUPER_ADMIN]
POST   /api/v1/tenants/:id/regenerate-api-key → [SUPER_ADMIN]

GET    /api/v1/tenants/me/profile      → بيانات شركتي [TENANT_ADMIN]
GET    /api/v1/tenants/me/stats        → إحصائيات شركتي [TENANT_ADMIN]




flow

SuperAdmin ──POST /tenants──►  TenantsService.create()
                                      │
                              $transaction
                              ├── tenant.create() → apiKey + apiSecret
                              └── user.create()   → TENANT_ADMIN

TenantAdmin ──GET /tenants/me/profile──► getMyTenant(tenantId من الـ JWT)
                                                │
                                         findOne(tenantId)
                                         بدون apiSecret ✅