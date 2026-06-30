# Auth
POST  /auth/login
GET   /auth/me

# Tenants
POST  /tenants
GET   /tenants
PATCH /tenants/:id
POST  /tenants/:id/regenerate-api-key
GET   /tenants/me/profile
GET   /tenants/me/stats

# Drivers
POST  /drivers
GET   /drivers
PATCH /drivers/:id
PATCH /drivers/me/location
PATCH /drivers/me/online
PATCH /drivers/me/offline
GET   /drivers/me/stats

# Orders
POST  /orders
GET   /orders
GET   /orders/:id
POST  /orders/:id/assign
PATCH /orders/:id/status
POST  /orders/:id/otp/send
POST  /orders/:id/otp/verify
PATCH /orders/:id/cancel

# Tracking (Public)
GET   /tracking/:trackingCode
GET   /tracking/live/drivers

# Webhooks
POST  /webhooks
GET   /webhooks
POST  /webhooks/:id/rotate-secret
GET   /webhooks/logs
POST  /webhooks/logs/:logId/retry