# Shipping API — Architecture Overview

This document describes the backend present in this repository. It does not describe a production deployment or claim that separately planned client applications exist.

## Stack

| Layer                   | Technology / implementation                                                        |
| ----------------------- | ---------------------------------------------------------------------------------- |
| API                     | NestJS 11 + TypeScript                                                             |
| Database                | PostgreSQL through Prisma 6                                                        |
| Queue and rate limiting | Redis, Bull, and `nestjs-throttler-storage-redis`                                  |
| Object storage          | AWS S3, Cloudflare R2, or MinIO through the S3 client                              |
| Push                    | Firebase Cloud Messaging through Firebase Admin                                    |
| SMS                     | Stub only; no SMS provider is wired                                                |
| Authentication          | JWT routes; a tenant API-key Passport strategy exists but is not applied to routes |
| Localization            | `nestjs-i18n`, Arabic default, English catalogs                                    |
| API documentation       | Swagger / OpenAPI                                                                  |

## Providers and Runtime

### Database

- `src/database/database.module.ts` provides the global `DatabaseService`, which extends Prisma Client.
- `DATABASE_URL` configures the PostgreSQL connection. The Prisma datasource does not pin a PostgreSQL server version.
- `prisma/schema.prisma` defines the data model; migrations are in `prisma/migrations/`.

### Redis and Bull

- `src/redis/redis.module.ts` creates the Redis client; Bull and throttler storage are configured in `src/app.module.ts`.
- The Bull queue is used for outbound webhook delivery, with five attempts and exponential backoff. SMS and push sends are not dispatched through Bull in the current code.
- No general-purpose cache service is implemented.

### Firebase Cloud Messaging

- `src/config/firebase.config.ts` initializes Firebase Admin using `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`. Initialization errors are caught and logged; push delivery requires a usable Firebase app and driver token.
- `NotificationsService` sends FCM messages inline and records notification state in the database.

### Object Storage

- `src/config/storage.config.ts` creates an S3-compatible client for AWS S3 (default), Cloudflare R2, or MinIO, selected by `STORAGE_PROVIDER`.
- Bucket names are provider-specific (`S3_BUCKET`, `R2_BUCKET`, or `MINIO_BUCKET`). The storage module processes delivery and return photos; availability depends on valid provider configuration.

### SMS

- `src/modules/sms/` builds localized messages, stores redacted/phone-masked logs, marks the send failed, and returns `provider_unavailable`.
- There is no Unifonic adapter or other SMS provider implementation. `SMS_PROVIDER` and `SMS_API_KEY` are present in `.env.example` but are not read by the current service.

## Repository Structure

```text
src/
├── app.module.ts            # Global modules and guards
├── main.ts                  # Bootstrap, CORS, Swagger
├── config/                  # App, database, JWT, Firebase, storage configuration
├── database/                # Prisma client provider
├── redis/                   # Redis client provider
├── common/                  # Guards, decorators, filters, pipes, shared types
├── i18n/                    # Arabic and English catalogs and language resolution
├── cli/                     # create-admin command
└── modules/
    ├── auth/                # Login, refresh, current-user lookup, JWT/API-key strategies
    ├── tenants/             # Tenant management and API-key generation
    ├── users/               # Empty controller and service placeholders
    ├── drivers/              # Driver management and status/location operations
    ├── orders/               # Order lifecycle, assignment, and OTP verification
    ├── tracking/             # Socket.IO driver/order tracking
    ├── returns/              # Return-request lifecycle and warehouse OTP verification
    ├── webhooks/             # Webhook management and queued delivery
    ├── notifications/        # Inline FCM sends and notification records
    ├── sms/                  # SMS message/logging stub; no provider
    ├── storage/              # Photo processing and S3-compatible storage
    └── pdpl/                 # PDPL-oriented logging/anonymization scaffolding
```

There is no dashboard or mobile-app source in this repository. Any React dashboard or React Native app is outside this project and is not documented here as an implemented client.

## Database Schema

The following lists every scalar Prisma field (database column) for each model. Relation fields such as `tenant`, `driver`, and `statusHistory` are Prisma relations, not additional columns. Unless noted, `String` IDs use `@default(uuid())`; `?` means nullable. Status fields are `String` columns unless a Prisma enum is explicitly named below.

### `Tenant`

| Column      | Prisma declaration            |
| ----------- | ----------------------------- |
| `id`        | `String @id @default(uuid())` |
| `name`      | `String`                      |
| `slug`      | `String @unique`              |
| `plan`      | `String @default("basic")`    |
| `apiKey`    | `String @unique`              |
| `isActive`  | `Boolean @default(true)`      |
| `settings`  | `Json @default("{}")`         |
| `createdAt` | `DateTime @default(now())`    |
| `updatedAt` | `DateTime @updatedAt`         |

`apiSecret` is not in the current model. The API-key strategy exists, but is not applied to routes.

### `User`

| Column      | Prisma declaration                  |
| ----------- | ----------------------------------- |
| `id`        | `String @id @default(uuid())`       |
| `email`     | `String @unique`                    |
| `password`  | `String`                            |
| `name`      | `String`                            |
| `role`      | `String`                            |
| `isActive`  | `Boolean @default(true)`            |
| `lang`      | `String @default("ar")`             |
| `driverId`  | `String? @unique @map("driver_id")` |
| `tenantId`  | `String?`                           |
| `createdAt` | `DateTime @default(now())`          |
| `updatedAt` | `DateTime @updatedAt`               |

### `Driver`

| Column           | Prisma declaration               |
| ---------------- | -------------------------------- |
| `id`             | `String @id @default(uuid())`    |
| `name`           | `String`                         |
| `phone`          | `String @unique`                 |
| `email`          | `String?`                        |
| `nationalId`     | `String`                         |
| `vehicleType`    | `String`                         |
| `vehiclePlate`   | `String`                         |
| `status`         | `String @default("OFFLINE")`     |
| `isActive`       | `Boolean @default(true)`         |
| `currentLat`     | `Float?`                         |
| `currentLng`     | `Float?`                         |
| `lastLocationAt` | `DateTime?`                      |
| `fcmToken`       | `String? @map("fcm_token")`      |
| `fcmTokenAt`     | `DateTime? @map("fcm_token_at")` |
| `lang`           | `String @default("ar")`          |
| `tenantId`       | `String?`                        |
| `createdAt`      | `DateTime @default(now())`       |
| `updatedAt`      | `DateTime @updatedAt`            |

### `Order`

| Column             | Prisma declaration                             |
| ------------------ | ---------------------------------------------- |
| `id`               | `String @id @default(uuid())`                  |
| `trackingCode`     | `String @unique`                               |
| `externalRef`      | `String?`                                      |
| `status`           | `String @default("PENDING")`                   |
| `senderName`       | `String`                                       |
| `senderPhone`      | `String`                                       |
| `senderAddress`    | `String`                                       |
| `senderLat`        | `Float?`                                       |
| `senderLng`        | `Float?`                                       |
| `recipientName`    | `String`                                       |
| `recipientPhone`   | `String`                                       |
| `recipientAddress` | `String`                                       |
| `recipientLat`     | `Float?`                                       |
| `recipientLng`     | `Float?`                                       |
| `recipientLang`    | `String @default("ar") @map("recipient_lang")` |
| `description`      | `String?`                                      |
| `weight`           | `Float?`                                       |
| `codAmount`        | `Float @default(0)`                            |
| `notes`            | `String?`                                      |
| `otpCode`          | `String?`                                      |
| `otpExpiresAt`     | `DateTime?`                                    |
| `otpVerifiedAt`    | `DateTime?`                                    |
| `deliveryPhoto`    | `String?`                                      |
| `deliveryPhotoKey` | `String?`                                      |
| `deliveredAt`      | `DateTime?`                                    |
| `pickedUpAt`       | `DateTime?`                                    |
| `failedReason`     | `String?`                                      |
| `driverId`         | `String?`                                      |
| `tenantId`         | `String?`                                      |
| `createdAt`        | `DateTime @default(now())`                     |
| `updatedAt`        | `DateTime @updatedAt`                          |

### `OrderStatusHistory`

| Column          | Prisma declaration            |
| --------------- | ----------------------------- |
| `id`            | `String @id @default(uuid())` |
| `orderId`       | `String`                      |
| `fromStatus`    | `String?`                     |
| `toStatus`      | `String`                      |
| `changedByType` | `String`                      |
| `changedById`   | `String?`                     |
| `note`          | `String?`                     |
| `createdAt`     | `DateTime @default(now())`    |

### `Webhook`

| Column      | Prisma declaration            |
| ----------- | ----------------------------- |
| `id`        | `String @id @default(uuid())` |
| `url`       | `String`                      |
| `events`    | `String[]`                    |
| `secret`    | `String?`                     |
| `isActive`  | `Boolean @default(true)`      |
| `tenantId`  | `String?`                     |
| `createdAt` | `DateTime @default(now())`    |
| `updatedAt` | `DateTime @updatedAt`         |

### `WebhookLog`

| Column           | Prisma declaration            |
| ---------------- | ----------------------------- |
| `id`             | `String @id @default(uuid())` |
| `webhookId`      | `String`                      |
| `orderId`        | `String?`                     |
| `event`          | `String`                      |
| `payload`        | `Json`                        |
| `status`         | `String @default("pending")`  |
| `attempts`       | `Int @default(0)`             |
| `responseStatus` | `Int?`                        |
| `responseBody`   | `String?`                     |
| `nextRetryAt`    | `DateTime?`                   |
| `createdAt`      | `DateTime @default(now())`    |

### `ReturnRequest`

| Column                | Prisma declaration                                  |
| --------------------- | --------------------------------------------------- |
| `id`                  | `String @id @default(uuid())`                       |
| `orderId`             | `String @map("order_id")`; indexed, not unique      |
| `tenantId`            | `String @map("tenant_id")`                          |
| `driverId`            | `String? @map("driver_id")`                         |
| `reason`              | `String`                                            |
| `notes`               | `String?`                                           |
| `requestedBy`         | `String @map("requested_by")`                       |
| `warehouseName`       | `String @map("warehouse_name")`                     |
| `warehousePhone`      | `String @map("warehouse_phone")`                    |
| `warehouseAddress`    | `String @map("warehouse_address")`                  |
| `warehouseLat`        | `Decimal? @db.Decimal(10, 8) @map("warehouse_lat")` |
| `warehouseLng`        | `Decimal? @db.Decimal(11, 8) @map("warehouse_lng")` |
| `warehouseLang`       | `String @default("ar") @map("warehouse_lang")`      |
| `status`              | `String @default("pending")`                        |
| `originalOrderStatus` | `String? @map("original_order_status")`             |
| `productPhoto`        | `String? @map("product_photo")`                     |
| `productPhotoKey`     | `String? @map("product_photo_key")`                 |
| `otpCode`             | `String? @map("otp_code")`                          |
| `otpExpiresAt`        | `DateTime? @map("otp_expires_at")`                  |
| `otpVerifiedAt`       | `DateTime? @map("otp_verified_at")`                 |
| `returnedAt`          | `DateTime? @map("returned_at")`                     |
| `createdAt`           | `DateTime @default(now()) @map("created_at")`       |
| `updatedAt`           | `DateTime @updatedAt @map("updated_at")`            |

### `ReturnStatusHistory`

| Column            | Prisma declaration                            |
| ----------------- | --------------------------------------------- |
| `id`              | `String @id @default(uuid())`                 |
| `returnRequestId` | `String @map("return_request_id")`            |
| `fromStatus`      | `String? @map("from_status")`                 |
| `toStatus`        | `String`                                      |
| `note`            | `String?`                                     |
| `changedByType`   | `String @map("changed_by_type")`              |
| `changedById`     | `String? @map("changed_by_id")`               |
| `createdAt`       | `DateTime @default(now()) @map("created_at")` |

### `SmsLog`

| Column           | Prisma declaration                            |
| ---------------- | --------------------------------------------- |
| `id`             | `String @id @default(uuid())`                 |
| `tenantId`       | `String? @map("tenant_id")`                   |
| `orderId`        | `String? @map("order_id")`                    |
| `phone`          | `String`                                      |
| `message`        | `String @db.Text`                             |
| `template`       | `String`                                      |
| `status`         | `String @default("pending")`                  |
| `externalId`     | `String? @map("external_id")`                 |
| `responseStatus` | `Int? @map("response_status")`                |
| `responseBody`   | `String? @db.Text @map("response_body")`      |
| `cost`           | `Decimal? @db.Decimal(8, 4)`                  |
| `sentAt`         | `DateTime? @map("sent_at")`                   |
| `createdAt`      | `DateTime @default(now()) @map("created_at")` |

The current SMS stub writes `pending` then `failed`; the stats endpoint also queries historical `sent` rows.

### `Notification`

| Column      | Prisma declaration                            |
| ----------- | --------------------------------------------- |
| `id`        | `String @id @default(uuid())`                 |
| `tenantId`  | `String @map("tenant_id")`                    |
| `driverId`  | `String @map("driver_id")`                    |
| `type`      | `String`                                      |
| `title`     | `String`                                      |
| `body`      | `String`                                      |
| `data`      | `Json?`                                       |
| `status`    | `String @default("PENDING")`                  |
| `sentAt`    | `DateTime? @map("sent_at")`                   |
| `readAt`    | `DateTime? @map("read_at")`                   |
| `createdAt` | `DateTime @default(now()) @map("created_at")` |

### `ConsentLog`

| Column        | Prisma declaration                              |
| ------------- | ----------------------------------------------- |
| `id`          | `String @id @default(uuid())`                   |
| `tenantId`    | `String @map("tenant_id")`                      |
| `entityType`  | `String @map("entity_type")`                    |
| `entityId`    | `String? @map("entity_id")`                     |
| `phone`       | `String`                                        |
| `purpose`     | `String`                                        |
| `version`     | `String @default("1.0")`                        |
| `ipAddress`   | `String? @map("ip_address")`                    |
| `consentedAt` | `DateTime @default(now()) @map("consented_at")` |
| `revokedAt`   | `DateTime? @map("revoked_at")`                  |
| `isActive`    | `Boolean @default(true) @map("is_active")`      |

### `DataRequest`

| Column          | Prisma declaration                            |
| --------------- | --------------------------------------------- |
| `id`            | `String @id @default(uuid())`                 |
| `tenantId`      | `String @map("tenant_id")`                    |
| `type`          | `DataRequestType`                             |
| `status`        | `DataRequestStatus @default(PENDING)`         |
| `requesterType` | `String @map("requester_type")`               |
| `phone`         | `String?`                                     |
| `driverId`      | `String? @map("driver_id")`                   |
| `reason`        | `String?`                                     |
| `notes`         | `String?`                                     |
| `handledBy`     | `String? @map("handled_by")`                  |
| `handledAt`     | `DateTime? @map("handled_at")`                |
| `dueAt`         | `DateTime @map("due_at")`                     |
| `reportUrl`     | `String? @map("report_url")`                  |
| `createdAt`     | `DateTime @default(now()) @map("created_at")` |
| `updatedAt`     | `DateTime @updatedAt @map("updated_at")`      |

### `BreachLog`

| Column             | Prisma declaration                            |
| ------------------ | --------------------------------------------- |
| `id`               | `String @id @default(uuid())`                 |
| `tenantId`         | `String? @map("tenant_id")`                   |
| `severity`         | `String`                                      |
| `description`      | `String @db.Text`                             |
| `affectedEntities` | `Int @default(0) @map("affected_entities")`   |
| `dataTypes`        | `Json`                                        |
| `detectedAt`       | `DateTime @map("detected_at")`                |
| `reportedAt`       | `DateTime? @map("reported_at")`               |
| `resolvedAt`       | `DateTime? @map("resolved_at")`               |
| `actions`          | `Json?`                                       |
| `createdAt`        | `DateTime @default(now()) @map("created_at")` |

### `DataAccessLog`

| Column       | Prisma declaration                            |
| ------------ | --------------------------------------------- |
| `id`         | `String @id @default(uuid())`                 |
| `tenantId`   | `String? @map("tenant_id")`                   |
| `userId`     | `String @map("user_id")`                      |
| `action`     | `String`                                      |
| `dataType`   | `String @map("data_type")`                    |
| `entityType` | `String @map("entity_type")`                  |
| `entityId`   | `String @map("entity_id")`                    |
| `ipAddress`  | `String? @map("ip_address")`                  |
| `userAgent`  | `String? @map("user_agent")`                  |
| `createdAt`  | `DateTime @default(now()) @map("created_at")` |

The code-defined `OrderStatus`, `DriverStatus`, `ReturnStatus`, notification status/type values, webhook/SMS log states, and Prisma `DataRequestType`/`DataRequestStatus` are listed in [Statuses and Flows](#statuses-and-flows). The database columns remain strings except for the two `DataRequest` Prisma enum fields.

## Statuses and Flows

### Order status

`OrderStatus` values are `PENDING`, `ASSIGNED`, `PICKED_UP`, `IN_TRANSIT`, `DELIVERED`, `FAILED`, `RETURNED`, and `CANCELLED`.

The `OrderStatusMeta.allowedTransitions` map is:

```text
PENDING     -> ASSIGNED, CANCELLED
ASSIGNED    -> PICKED_UP, CANCELLED
PICKED_UP   -> IN_TRANSIT
IN_TRANSIT  -> DELIVERED, FAILED
DELIVERED   -> (no transitions)
FAILED      -> (no transitions)
RETURNED    -> (no transitions)
CANCELLED   -> (no transitions)
```

Delivery completion uses OTP verification. Return creation is a separate operation: it accepts source orders in `DELIVERED`, `FAILED`, or `IN_TRANSIT`, stores their prior status, and directly changes the order to `RETURNED`; this is not an `OrderStatusMeta` transition.

### Return status

`ReturnStatus` values are `pending`, `assigned`, `picked_up`, `in_transit`, `returned`, and `cancelled`.

```text
pending     -> assigned, cancelled
assigned    -> picked_up, cancelled
picked_up   -> in_transit
in_transit  -> returned (warehouse OTP verification only)
returned    -> (no transitions)
cancelled   -> (no transitions)
```

The generic driver status endpoint rejects `returned`; warehouse OTP verification performs the final transition. Return cancellation is allowed only while `pending` or `assigned` and restores the source order's saved status.

### Other status and type values

- **Driver status:** `AVAILABLE`, `BUSY`, `OFFLINE` (`DriverStatus` in `src/common/enums/driver-status.enum.ts`).
- **Webhook log status:** `pending`, `success`, `failed` (string values written/read by the webhook service and processor).
- **SMS log status:** `pending` and `failed` are written by the current stub. The stats endpoint also queries `sent` for records from a provider implementation that is not present.
- **Notification status:** `PENDING`, `FAILED`, `SENT`, `READ` (stored string values in `NotificationsService`).
- **Notification type:** `new_order`, `new_return`, `order_cancelled`, `reminder`, `announcement` (`NotificationType`).
- **Data request type:** `ACCESS`, `RECTIFICATION`, `ERASURE`, `PORTABILITY`, `OBJECTION` (`DataRequestType`).
- **Data request status:** `PENDING`, `IN_PROGRESS`, `COMPLETED`, `REJECTED` (`DataRequestStatus`).

## Backend Flows

### Order lifecycle

The status map above is the source for the regular order lifecycle. Assignment moves a pending order to assigned; driver updates move it through pickup and transit; OTP verification completes delivery. Cancellation is available from pending/assigned, failure from in-transit, and return creation can set eligible source orders to returned.

Webhooks, push notifications, and SMS are not guaranteed atomic with a business-state update. SMS currently fails by design because it is a stub; push and webhook dispatch use their own current service paths.

### Return lifecycle

The return begins when a returnable source order is changed to `RETURNED` and a new request is created as `pending`. Assignment and driver progress follow the exact `ReturnStatus` transition map above. Warehouse OTP verification completes a return as `returned`; cancelling a pending/assigned request restores the original order status.

### Authentication

- **User and driver endpoints:** JWT authentication through Passport JWT, with role checks on protected routes.
- **Tenant API key:** A Passport strategy using `passport-headerapikey` and `X-API-Key` exists, but is not wired to any route. There is no tenant API secret. Protected endpoints use JWT only; see [Known Limitations](README.md#known-limitations--not-implemented).

## Frontend Clients

No dashboard or mobile-client project is included in this repository. A React dashboard or React Native driver/customer app may be a consumer concept, but this document makes no claim that either client exists or works.

## Environment Variables

The following variables are read by the current application, config, or seed code. Variables shown in `.env.example` but not read by the code are listed separately below.

| Variable                     | Usage                                                                                                |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| `PORT`                       | HTTP server listen port                                                                              |
| `NODE_ENV`                   | Runtime mode and non-production Swagger exposure                                                     |
| `ALLOWED_ORIGINS`            | Comma-separated CORS origins                                                                         |
| `PUBLIC_URL`                 | Base URL for customer tracking links                                                                 |
| `DATABASE_URL`               | Prisma PostgreSQL connection                                                                         |
| `JWT_SECRET`                 | JWT signing and verification                                                                         |
| `JWT_EXPIRES_IN`             | Configured JWT expiry value; auth token issuance currently sets explicit 15-minute/7-day expirations |
| `REDIS_HOST`                 | Redis and Bull connection host                                                                       |
| `REDIS_PORT`                 | Redis and Bull connection port                                                                       |
| `STORAGE_PROVIDER`           | Selects `s3`, `r2`, or `minio`                                                                       |
| `S3_BUCKET`                  | AWS S3 bucket name                                                                                   |
| `S3_REGION`                  | AWS S3 region                                                                                        |
| `S3_ACCESS_KEY`              | AWS S3 access key                                                                                    |
| `S3_SECRET_KEY`              | AWS S3 secret key                                                                                    |
| `R2_ACCOUNT_ID`              | Cloudflare R2 endpoint account ID                                                                    |
| `R2_ACCESS_KEY`              | Cloudflare R2 access key                                                                             |
| `R2_SECRET_KEY`              | Cloudflare R2 secret key                                                                             |
| `R2_BUCKET`                  | Cloudflare R2 bucket name                                                                            |
| `R2_PUBLIC_URL`              | Optional public base URL for R2 objects                                                              |
| `MINIO_ENDPOINT`             | MinIO endpoint                                                                                       |
| `MINIO_ACCESS_KEY`           | MinIO access key                                                                                     |
| `MINIO_SECRET_KEY`           | MinIO secret key                                                                                     |
| `MINIO_BUCKET`               | MinIO bucket name                                                                                    |
| `FIREBASE_PROJECT_ID`        | Firebase Admin project ID                                                                            |
| `FIREBASE_CLIENT_EMAIL`      | Firebase service-account email                                                                       |
| `FIREBASE_PRIVATE_KEY`       | Firebase service-account private key                                                                 |
| `SUPER_ADMIN_EMAIL`          | Required super-admin seed email                                                                      |
| `SUPER_ADMIN_PASSWORD`       | Required super-admin seed password                                                                   |
| `SUPER_ADMIN_NAME`           | Optional super-admin seed name                                                                       |
| `DEMO_TENANT_ADMIN_PASSWORD` | Required demo tenant-admin seed password                                                             |
| `DEMO_DRIVER_PASSWORD`       | Required demo driver seed password                                                                   |

`SMS_PROVIDER` and `SMS_API_KEY` appear in `.env.example` but are not currently read; setting them does not enable SMS delivery. `SMS_LOG_ONLY` is neither read by the application nor present in the current `.env.example`. `JWT_EXPIRES_IN` is read by `src/config/jwt.config.ts`, but that config factory is not loaded by `ConfigModule`; current token issuance uses explicit expirations in `AuthService`.
