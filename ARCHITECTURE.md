# Shipping API — Architecture Overview

## Stack

| Layer         | Technology                          |
| ------------- | ----------------------------------- |
| **API**       | NestJS 11 + TypeScript              |
| **DB**        | PostgreSQL 16 + Prisma 6 (ORM)      |
| **Cache/Q**   | Redis 7 (Bull queues, rate-limit)   |
| **Storage**   | AWS S3 / Cloudflare R2 / MinIO      |
| **Push**      | Firebase Cloud Messaging (FCM)      |
| **SMS**       | Unifonic                            |
| **Auth**      | JWT (passport) + API Keys (tenants) |
| **I18n**      | nestjs-i18n (Arabic default)        |
| **Docs**      | Swagger (OpenAPI)                   |
| **Dashboard** | React (separate project)            |
| **Mobile**    | React Native (separate project)     |

---

## Providers

### Database (PostgreSQL + Prisma)

- **Module:** `src/database/database.module.ts` — Global module.
- **Service:** `DatabaseService` extends `PrismaClient`, connects on module init.
- **Config:** `DATABASE_URL` env var.
- **Schema:** `prisma/schema.prisma` — single source of truth. Migrations in `prisma/migrations/`.

### Redis

- **Module:** `src/redis/redis.module.ts`.
- Used for:
  - Bull job queues (webhooks, SMS, notifications)
  - Rate-limit storage (nestjs-throttler-storage-redis)
  - General caching (if needed later)

### Firebase Cloud Messaging

- **File:** `src/config/firebase.config.ts`.
- Initialized from env: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.
- Singleton `admin.app` — gracefully skips if vars missing.
- Exposes `getFirebaseMessaging()` for push notifications to drivers.

### S3 / Object Storage

- **File:** `src/config/storage.config.ts`.
- Supports **AWS S3**, **Cloudflare R2**, and **MinIO** via `STORAGE_PROVIDER` env var.
- Bucket: `S3_BUCKET` env — stores delivery photos & return product photos.

### SMS (Unifonic)

- **Module:** `src/modules/sms/`.
- Provider: Unifonic (configurable via `SMS_PROVIDER`).
- Dev mode: `SMS_LOG_ONLY=true` logs instead of sending.

### Bull Queues

- **Module:** `src/modules/notifications/` — push notifications.
- Also used for webhook delivery (retry + backoff) and SMS dispatch.
- Redis-backed with exponential backoff (5 attempts).

---

## Directory Structure

```
src/
├── app.module.ts            # Root module — imports everything
├── main.ts                  # Bootstrap (Swagger, Firebase, CORS, etc.)
│
├── config/                  # NestJS ConfigService-based factories
│   ├── app.config.ts
│   ├── database.config.ts
│   ├── firebase.config.ts
│   ├── jwt.config.ts
│   └── storage.config.ts
│
├── database/                # Prisma client provider
│   ├── database.module.ts   # @Global() — no need to re-import
│   └── database.service.ts  # extends PrismaClient
│
├── redis/                   # Redis client provider
│   └── redis.module.ts
│
├── common/                  # Shared infrastructure
│   ├── config/              # Runtime config validation
│   ├── constants/
│   ├── decorators/          # @CurrentUser, @Roles, etc.
│   ├── enums/               # Shared enums
│   ├── filters/             # Exception filters
│   ├── guards/              # JwtAuthGuard, RolesGuard, ThrottlerGuard
│   ├── interceptors/        # Logging, transformation
│   ├── pipes/               # Validation pipes
│   ├── swagger/             # Swagger decorators/helpers
│   ├── types/               # Extended express types
│   └── utils/               # Helpers (OTP, phone format, etc.)
│
├── modules/                 # Feature modules (domain-driven)
│   ├── auth/                # Login, register, JWT issuance
│   ├── tenants/             # Multi-tenant management
│   ├── users/               # User CRUD (dashboard admins)
│   ├── drivers/             # Driver CRUD + status
│   ├── orders/              # Order lifecycle
│   ├── tracking/            # Real-time driver location (Socket.IO)
│   ├── returns/             # Return request workflow
│   ├── webhooks/            # Outbound webhooks (tenant callbacks)
│   ├── notifications/       # FCM push + Bull queue
│   ├── sms/                 # SMS dispatch
│   ├── storage/             # Photo upload/presigned URLs
│   └── pdpl/                # Saudi PDPL compliance (data requests, consent, breach logs)
│
├── cli/                     # CLI commands (create-admin, etc.)
│
└── i18n/                    # Translation files (ar/en)
```

---

## Database Schema

### `Tenant`

| Column    | Type     | Notes                      |
| --------- | -------- | -------------------------- |
| id        | UUID     | PK                         |
| name      | String   |                            |
| slug      | String   | Unique — URL-friendly      |
| plan      | String   | `"basic"` / `"pro"` / etc. |
| apiKey    | String   | Unique — for API key auth  |
| isActive  | Boolean  |                            |
| settings  | JSON     | Tenant-specific config     |
| createdAt | DateTime |                            |
| updatedAt | DateTime |                            |

Relations: `users[]`, `drivers[]`, `orders[]`, `webhooks[]`, `returnRequests[]`, `notifications[]`, `smsLogs[]`, `consentLogs[]`, `dataRequests[]`, `breachLogs[]`, `dataAccessLogs[]`

### `User`

| Column   | Type    | Notes                                            |
| -------- | ------- | ------------------------------------------------ |
| id       | UUID    | PK                                               |
| email    | String  | Unique                                           |
| password | String  | bcryptjs                                         |
| name     | String  |                                                  |
| role     | String  | `"super_admin"`, `"admin"`, `"ops"`, `"support"` |
| isActive | Boolean |                                                  |
| lang     | String  | `"ar"` / `"en"`                                  |
| driverId | UUID?   | Links driver account                             |
| tenantId | UUID?   | Null for super_admin                             |

### `Driver`

| Column         | Type      | Notes                               |
| -------------- | --------- | ----------------------------------- |
| id             | UUID      | PK                                  |
| name           | String    |                                     |
| phone          | String    | Unique                              |
| email          | String?   |                                     |
| nationalId     | String    |                                     |
| vehicleType    | String    |                                     |
| vehiclePlate   | String    |                                     |
| status         | String    | `"ONLINE"` / `"OFFLINE"` / `"BUSY"` |
| isActive       | Boolean   |                                     |
| currentLat     | Float?    | Real-time tracking                  |
| currentLng     | Float?    |                                     |
| lastLocationAt | DateTime? |                                     |
| fcmToken       | String?   | Push notification token             |
| tenantId       | UUID?     |                                     |

### `Order`

| Column           | Type      | Notes                                                                        |
| ---------------- | --------- | ---------------------------------------------------------------------------- |
| id               | UUID      | PK                                                                           |
| trackingCode     | String    | Unique — auto-generated                                                      |
| externalRef      | String?   | Tenant's own ref number                                                      |
| status           | String    | `PENDING` → `ASSIGNED` → `PICKED_UP` → `IN_TRANSIT` → `DELIVERED` / `FAILED` |
| senderName       | String    |                                                                              |
| senderPhone      | String    |                                                                              |
| senderAddress    | String    |                                                                              |
| senderLat/Lng    | Float?    |                                                                              |
| recipientName    | String    |                                                                              |
| recipientPhone   | String    |                                                                              |
| recipientAddress | String    |                                                                              |
| recipientLat/Lng | Float?    |                                                                              |
| description      | String?   |                                                                              |
| weight           | Float?    |                                                                              |
| codAmount        | Float     | Cash on delivery                                                             |
| notes            | String?   |                                                                              |
| otpCode          | String?   | Delivery OTP                                                                 |
| otpExpiresAt     | DateTime? |                                                                              |
| otpVerifiedAt    | DateTime? |                                                                              |
| deliveryPhoto    | String?   | Signed URL                                                                   |
| deliveryPhotoKey | String?   | S3 object key                                                                |
| deliveredAt      | DateTime? |                                                                              |
| pickedUpAt       | DateTime? |                                                                              |
| failedReason     | String?   |                                                                              |
| driverId         | UUID?     |                                                                              |
| tenantId         | UUID?     |                                                                              |

Relations: `statusHistory[]`, `webhookLogs[]`, `returnRequests[]`

### `OrderStatusHistory`

Tracks every status transition — immutable audit log.

| Column        | Type    |
| ------------- | ------- |
| id            | UUID    |
| orderId       | UUID    |
| fromStatus    | String? |
| toStatus      | String  |
| changedByType | String  | `"system"`, `"driver"`, `"admin"`, `"tenant"` |
| changedById   | String? |
| note          | String? |

### `Webhook`

| Column   | Type     |
| -------- | -------- |
| id       | UUID     |
| url      | String   |
| events   | String[] | e.g. `["order.delivered", "order.failed"]` |
| secret   | String?  | HMAC signing                               |
| isActive | Boolean  |
| tenantId | UUID?    |

### `WebhookLog`

| Column         | Type      |
| -------------- | --------- |
| id             | UUID      |
| webhookId      | UUID      |
| orderId        | UUID?     |
| event          | String    |
| payload        | JSON      |
| status         | String    | `"pending"`, `"delivered"`, `"failed"` |
| attempts       | Int       |
| responseStatus | Int?      |
| responseBody   | String?   |
| nextRetryAt    | DateTime? |

### `ReturnRequest`

| Column           | Type      |
| ---------------- | --------- |
| id               | UUID      |
| orderId          | UUID      | Unique — one return per order                                            |
| tenantId         | UUID      |
| driverId         | UUID?     |
| reason           | String    |
| notes            | String?   |
| requestedBy      | String    |
| warehouseName    | String    |
| warehousePhone   | String    |
| warehouseAddress | String    |
| warehouseLat     | Decimal?  |
| warehouseLng     | Decimal?  |
| status           | String    | `"pending"` → `"approved"` → `"picked_up"` → `"returned"` / `"rejected"` |
| productPhoto     | String?   |
| productPhotoKey  | String?   |
| otpCode          | String?   |
| otpExpiresAt     | DateTime? |
| otpVerifiedAt    | DateTime? |
| returnedAt       | DateTime? |

### `ReturnStatusHistory`

Same pattern as `OrderStatusHistory` — documents every step of the return.

### `SmsLog`

| Column         | Type      |
| -------------- | --------- |
| id             | UUID      |
| tenantId       | UUID?     |
| orderId        | UUID?     |
| phone          | String    |
| message        | Text      |
| template       | String    |
| status         | String    |
| externalId     | String?   |
| responseStatus | Int?      |
| responseBody   | Text?     |
| cost           | Decimal?  |
| sentAt         | DateTime? |

### `Notification`

| Column   | Type      |
| -------- | --------- |
| id       | UUID      |
| tenantId | UUID      |
| driverId | UUID      |
| type     | String    | `"order_assigned"`, `"delivery_otp"`, `"payment"`, etc. |
| title    | String    |
| body     | String    |
| data     | JSON?     |
| status   | String    | `"PENDING"` → `"SENT"` → `"READ"`                       |
| sentAt   | DateTime? |
| readAt   | DateTime? |

### PDPL (Saudi Personal Data Protection Law)

| Table           | Purpose                                                                          |
| --------------- | -------------------------------------------------------------------------------- |
| `ConsentLog`    | Records explicit consent from data subjects                                      |
| `DataRequest`   | Subject rights requests (access, rectification, erasure, portability, objection) |
| `BreachLog`     | Security breach documentation (mandatory under PDPL Art. 22)                     |
| `DataAccessLog` | Audit trail of who accessed what and when                                        |

---

## Frontend Architecture

### Dashboard (React)

Separate project consuming the REST API via `axios`/`react-query`.

**Auth flow:** JWT login → token stored in httpOnly cookie or `Authorization` header.

**Key pages:**

- Login
- Dashboard / KPIs
- Orders (list, detail, assign driver)
- Drivers (list, map view)
- Tenants (multi-tenant management)
- Returns (approve/reject workflow)
- Webhooks (configuration + logs)
- PDPL (data requests, consent audit)
- Settings (profile, language toggle)

### Mobile App (React Native)

Separate project — two entry points:

1. **Driver App** — receives push (FCM), sees assigned orders, navigates with GPS, takes delivery photos, scans OTP.
2. **Customer App** (optional) — tracks order status, receives SMS OTP.

**Auth flow:** Phone OTP or driver credentials.

**Real-time:** Socket.IO for location updates during delivery.

---

## Key Flows

### Order Lifecycle

```
PENDING → ASSIGNED → PICKED_UP → IN_TRANSIT → DELIVERED
                                    \           /
                                     → FAILED ←
```

1. Tenant creates order via API (web or REST).
2. Order gets `PENDING` status.
3. Admin assigns driver → status `ASSIGNED`.
4. Driver confirms pickup → `PICKED_UP`, delivery photo captured.
5. Driver navigates to recipient → status updates via Socket.IO.
6. Driver arrives → recipient provides OTP → `DELIVERED`.
7. On each transition: webhook fired, SMS sent, FCM pushed.

### Return Flow

```
pending → approved → picked_up → returned
    \                            /
     → rejected ←---------------
```

1. Customer requests return (via admin or tenant dashboard).
2. Admin approves → driver assigned to pick up.
3. Driver picks up product, scans OTP → `returned`.

### Authentication

- **Dashboard admins:** JWT (passport-jwt strategy).
- **Tenants (API consumers):** API Key + Secret (passport-headerapikey).
- **Drivers:** JWT (same strategy, restricted role).

---

## Environment Variables

| Variable                     | Description                                            |
| ---------------------------- | ------------------------------------------------------ |
| `PORT`                       | API server port                                        |
| `NODE_ENV`                   | `development` / `production`                           |
| `DATABASE_URL`               | PostgreSQL connection string                           |
| `JWT_SECRET`                 | JWT signing secret                                     |
| `JWT_EXPIRES_IN`             | Token expiry (e.g. `7d`)                               |
| `REDIS_HOST`                 | Redis host                                             |
| `REDIS_PORT`                 | Redis port                                             |
| `S3_BUCKET`                  | Storage bucket name                                    |
| `S3_REGION`                  | AWS region                                             |
| `S3_ACCESS_KEY`              | AWS / R2 / MinIO access key                            |
| `S3_SECRET_KEY`              | AWS / R2 / MinIO secret key                            |
| `STORAGE_PROVIDER`           | `s3` / `r2` / `minio`                                  |
| `FIREBASE_PROJECT_ID`        | Firebase project ID                                    |
| `FIREBASE_CLIENT_EMAIL`      | Firebase service account email                         |
| `FIREBASE_PRIVATE_KEY`       | Firebase private key                                   |
| `SMS_PROVIDER`               | `unifonic`                                             |
| `SMS_API_KEY`                | SMS provider API key                                   |
| `SMS_LOG_ONLY`               | `true` to log without sending                          |
| `SUPER_ADMIN_EMAIL`          | Required initial super-admin email                     |
| `SUPER_ADMIN_PASSWORD`       | Required initial super-admin password                  |
| `DEMO_TENANT_ADMIN_PASSWORD` | Required demo tenant-admin password (development seed) |
| `DEMO_DRIVER_PASSWORD`       | Required demo driver password (development seed)       |
