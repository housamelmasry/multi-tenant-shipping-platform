# Test Plan

## Purpose

Use this checklist to grow automated coverage for the Shipping API. Prioritize correctness, tenant isolation, and safe lifecycle transitions before adding broad performance tests.

Test against isolated fixtures or a disposable test database. Do not run reset or destructive lifecycle tests against the local development database. Mock external SMS, Firebase, S3, Redis, and webhook destinations in unit tests; use dedicated services in integration tests.

## Current Coverage

These tests already exist and pass in the current suite:

- [x] Auth controller identity handling, refresh-token type validation, driver identity attachment, and inactive-driver rejection: `src/modules/auth/auth.identity.spec.ts`.
- [x] Rejection of order OTP verification after the order leaves `IN_TRANSIT`, plus OTP cleanup when SMS is unavailable: `src/modules/orders/orders-otp.service.spec.ts`.
- [x] Private webhook address rejection and pinned-agent creation: `src/modules/webhooks/webhook-target.util.spec.ts`.
- [x] FCM announcement chunking and per-recipient outcomes: `src/modules/notifications/notifications.service.spec.ts`.
- [x] SMS provider-unavailable behavior: `src/modules/sms/sms.service.spec.ts`.
- [x] Locale catalogs, localized validation, translation helpers, and DTO/schema parity.
- [x] E2E health endpoint: `test/app.e2e-spec.ts`.
- [x] CI migration apply and schema-drift checks: `.github/workflows/ci.yml`.

The e2e suite currently does not exercise authenticated business workflows.

## P0: Core Correctness And Isolation

### Authentication and authorization

- [ ] Login succeeds for active users with the correct password and returns access/refresh tokens.
- [ ] Login rejects a wrong password, unknown email, inactive user, inactive tenant, and inactive linked driver with the same non-enumerating response.
- [ ] `/auth/me` returns the authenticated user and tenant, and rejects missing or invalid access tokens.
- [ ] Refresh accepts a valid, unexpired refresh token; rejects an access token, malformed token, expired token, and token for an inactive user/tenant/driver.
- [ ] Driver JWT exposes the linked driver-record ID; driver routes use that ID, not the user ID.
- [ ] Role matrix: super admin, tenant admin, tenant staff, and unauthenticated caller can access only intended endpoints.
- [ ] Cross-tenant IDs cannot read, mutate, or delete another tenant's orders, drivers, returns, webhooks, logs, or settings.
- [ ] Deactivating a tenant, user, or driver blocks subsequent requests using an existing JWT.

### Orders and drivers

- [ ] Creating an order stores the correct tenant, sender/recipient data, language, and initial history entry.
- [ ] Manual assignment rejects non-pending orders, missing/inactive/foreign-tenant drivers, and drivers that are offline or busy.
- [ ] Successful assignment updates order, driver, and status history atomically.
- [ ] Concurrent assignment attempts for one driver or one order allow at most one winner and leave no partial state.
- [ ] Driver status/location/device routes operate on the linked driver record and remain tenant-scoped.
- [ ] Zero latitude/longitude is treated as valid; missing coordinates are rejected for preview/auto-assignment.
- [ ] Auto-assignment honors maximum distance and chooses the nearest eligible driver; stale locations and unavailable drivers are excluded.
- [ ] Bulk assignment handles empty batches, missing coordinates, no available drivers, partial success, concurrent claims, and per-order errors without stopping the entire batch.
- [ ] Status transitions accept only configured transitions and produce a history entry matching the final state.
- [ ] Canceling an order releases the assigned driver only when appropriate and records the cancellation actor/history.

### Order OTP lifecycle

- [ ] OTP generation requires the assigned driver and an `IN_TRANSIT` order.
- [ ] OTP delivery success returns success and stores only the intended expiry/verification state.
- [ ] Wrong, expired, missing, and replayed OTPs are rejected.
- [ ] Verification requires the order to remain `IN_TRANSIT`; a failed/canceled/delivered order cannot be completed with a previously valid OTP.
- [ ] Two concurrent verification requests cannot both consume one OTP.
- [ ] Successful verification atomically marks delivered, clears OTP fields, releases the driver, stores proof metadata, and writes one history entry.
- [ ] Webhook failure after delivery does not undo or misreport the committed delivery; this should be covered once an outbox is implemented.

### Returns and migration

- [ ] Return creation accepts each documented returnable order state and rejects all other states.
- [ ] Concurrent return creation for one order results in exactly one active return request.
- [ ] A canceled return can be recreated for the same order; a completed return follows the explicitly chosen product policy.
- [ ] Cancellation restores the source order's original status, releases an assigned driver, and changes return/order/history atomically.
- [ ] Driver return transitions enforce the allowed transition graph; driver cancellation releases the driver.
- [ ] Warehouse OTP generation checks driver assignment and in-transit status, and uses the warehouse's saved language.
- [ ] Wrong, expired, replayed, or stale-state warehouse OTPs are rejected; concurrent verification has one winner.
- [ ] Return proof photo is uploaded to object storage, and the persisted URL/key is retrievable; absent photos remain null.
- [ ] Migration integration test covers an empty database and existing return rows: source status backfill uses the latest applicable order history (and the documented fallback), the old unique index is removed, and multiple historical returns can coexist.
- [ ] Cancellation/history records and source status remain correct after migration on a database containing representative pre-migration rows.

## P1: External Integrations And Reliability

### Webhooks

- [ ] Accept valid public HTTP and HTTPS URLs; reject unsupported schemes, URL credentials, malformed URLs, loopback, private, link-local, multicast, unspecified, and IPv4-mapped private IPv6 addresses.
- [ ] Test DNS responses containing both public and private addresses; reject the destination if any resolved address is non-public.
- [ ] Confirm actual socket connection uses the validated/pinned DNS address, redirects are not followed, and proxy environment variables cannot bypass the destination policy.
- [ ] Duplicate URL checks are tenant-scoped; one tenant cannot inspect or rotate another tenant's webhook secret.
- [ ] Request signature is deterministic over the exact serialized payload and verifies with the stored secret.
- [ ] Successful delivery, non-2xx response, timeout, network failure, retry/backoff, final failure, response truncation, and log attempt counts are correct.
- [ ] Queue insertion/database failure behavior is explicit; retries do not create duplicate business events or inconsistent logs.
- [ ] Retry endpoint rejects successful logs and enqueues failed logs with the correct URL, secret, payload, and tenant.
- [ ] Worker revalidates queued URLs so stale jobs cannot bypass destination policy.

### SMS and Firebase notifications

- [ ] Before enabling production OTP flows, integrate the selected SMS provider and test accepted/rejected recipients, provider timeouts, provider IDs, and retry-safe log states.
- [ ] No OTP or full phone number appears in application logs, error responses, or unrelated telemetry.
- [ ] SMS templates interpolate recipient language and all values correctly for Arabic and English; unknown locales use the documented fallback.
- [ ] OTP endpoints report success only after the configured provider accepts the send; failure clears or invalidates the OTP.
- [ ] FCM announcement sends 0, 1, 500, 501, and multiple-batch recipients; per-device success/failure is recorded accurately.
- [ ] A thrown Firebase error for one batch is reported without marking its recipients sent; later batches follow the documented continue/stop policy.
- [ ] Invalid/expired FCM tokens are removed; ordinary provider errors do not erase valid tokens.
- [ ] Push notification title/body follow each driver's saved language, including asynchronous/background delivery.

### Storage

- [ ] Accept supported image MIME types and reject unsupported types, oversized files, and malformed image content.
- [ ] Image rotation, resizing, output format, EXIF removal, tenant-scoped object key, upload failure, signed URL expiry, and deletion are verified.
- [ ] S3/R2/MinIO configuration failures are surfaced without persisting a broken photo reference.

### Rate limits and API keys

- [ ] Public, authenticated-user, driver, and tenant API-key requests use the intended rate-limit key and limits.
- [ ] Rate-limit counters expire/reset correctly and headers report limit, remaining, used, and reset consistently.
- [ ] If tenant API-key authentication is part of the supported contract, test valid/invalid/rotated keys, inactive tenants, tenant scoping, allowed endpoints, and rate limits. Otherwise remove stale API-key route/docs claims.

## P2: Domain And Operational Coverage

### PDPL, tracking, and notifications

- [ ] Consent creation, duplicate active consent, revocation, and consent lookup are tenant- and purpose-scoped.
- [ ] Data access reports include only the requesting data subject's records and redact unrelated sensitive fields.
- [ ] Customer/driver erasure anonymizes the intended fields, preserves required audit records, and is idempotent.
- [ ] Retention jobs delete/anonymize only records older than configured cutoffs and leave newer records untouched.
- [ ] Public tracking returns only permitted fields and never returns OTPs, internal IDs/secrets, or locations before the allowed delivery state.
- [ ] WebSocket authentication, tenant room isolation, initial snapshots, updates, disconnect cleanup, and malformed tokens are tested.
- [ ] Mark-one/mark-all notification reads are driver-scoped and idempotent; announcements to no eligible drivers return a localized response.

### API response and validation

- [ ] Every domain exception resolves in Arabic and English; missing translation keys fail catalog tests or produce the documented fallback.
- [ ] DTO validation returns localized property names, nested field paths, constraints, enum values, and unknown-field errors.
- [ ] Global response wrapping and exception filtering have e2e tests for both success and error payload shapes.
- [ ] Health endpoint stays public and returns success; protected API routes still reject anonymous callers.

### Migrations and data integrity

- [ ] Each migration applies to a clean PostgreSQL database and from the previous released schema.
- [ ] `prisma migrate status` is up to date and `prisma migrate diff --exit-code` reports no schema drift.
- [ ] Migration backfills are tested with empty, typical, and edge-case historical data; verify counts and preservation of foreign keys/indexes.
- [ ] Seed tests require credentials, do not print secrets, are idempotent for existing super-admin/demo tenant, and create demo rows only in development.

## P3: Performance And Resilience

- [ ] Benchmark order list/count queries with realistic per-tenant row counts and representative status/date/search filters; capture `EXPLAIN ANALYZE` before adding indexes.
- [ ] Benchmark driver list/search, notification history, webhook logs, and SMS stats with realistic row counts and pagination.
- [ ] Benchmark bulk auto-assignment with many pending orders and available drivers; track DB query count, elapsed time, and memory.
- [ ] Load-test frequent driver location updates and live tracking fan-out; measure Redis, database, and socket pressure.
- [ ] Simulate PostgreSQL/Redis/Firebase/S3/webhook outages and verify timeout bounds, retries, graceful errors, reconnection/shutdown, and no resource leaks.
- [ ] Run e2e tests repeatedly and verify Nest app, Prisma, Redis, queue workers, and timers all close so Jest exits without open-handle warnings.

## Suggested Implementation Order

1. Finish P0 auth, tenant-isolation, assignment, order/return, and OTP integration tests.
2. Add webhook/SMS/FCM/storage integration tests with provider mocks and an isolated PostgreSQL/Redis test environment.
3. Add migration backfill and seed idempotency tests to CI.
4. Add full-route e2e coverage for the main Postman workflows: login, create/list order, assign driver, status update, return lifecycle, and tenant isolation.
5. Benchmark representative data before changing indexes or adding broad load-test gates.

## Commands

```bash
yarn test --runInBand
yarn test:e2e -- --runInBand
yarn typecheck
yarn build
npx prisma validate
npx prisma migrate status
```
