# Business Logic Flow Gaps

Status: 2026-09-28

This document describes incomplete or underspecified product flows found in the current code. It complements [BLOCKERS.md](BLOCKERS.md), which tracks operational blockers, and [TEST_PLAN.md](TEST_PLAN.md), which lists verification cases. Items below are flow gaps or decisions; they are not all confirmed runtime defects.

## P0: Complete Before Relying On The Workflow

### Customer OTP and delivery confirmation

**Current flow:** A driver requests an OTP, the API saves it, asks `SmsService` to send it, and the API rejects the request if sending fails. `SmsService` currently has no provider adapter, so SMS always fails. Order delivery therefore cannot complete through the intended real-customer path.

**Missing flow steps:**

- Select and configure the SMS provider; define delivery-state handling and retries.
- Define what happens when a provider accepts a message but the API times out before receiving its response; use a provider idempotency key if available.
- Decide whether OTP resend invalidates all earlier codes immediately and how many resends/verification attempts are allowed.
- Add an operational way to support local tests without sending real SMS, such as a test provider that exposes generated codes only in test environments. Never return or log real OTPs in production.

**Relevant code:** `src/modules/sms/sms.service.ts`, `src/modules/orders/orders-otp.service.ts`, `src/modules/returns/returns.service.ts`.

### Outbound side effects after business commits

**Current flow:** Order/return state changes are committed, then webhooks, push, or SMS are attempted inline. Webhook log creation and queue insertion are separate writes.

**Missing flow steps:**

- Define a delivery contract: does failure to notify change the API result, or does the committed business change remain successful with a pending notification?
- Persist an outbox event atomically with each business mutation.
- Retry dispatch with idempotency and an operator-visible failed/replay state.
- Define which events are mandatory and which are best-effort.

Without this contract, callers can see an error after an order is already changed, or a notification can be permanently lost after a database/Redis failure.

**Relevant code:** `src/modules/orders/orders.service.ts`, `src/modules/orders/orders-assignment.service.ts`, `src/modules/returns/returns.service.ts`, `src/modules/webhooks/webhooks.service.ts`.

### PDPL data-subject verification and request fulfillment

**Current flow:** Public consent and revoke routes accept `tenantId`, `phone`, and `purpose` directly from the request. Tenant admins can create data requests. The request DTO accepts `ACCESS`, `RECTIFICATION`, `ERASURE`, and `PORTABILITY`, but report generation only handles `ACCESS`; separate erase routes do not link their result to a data request.

**Missing flow steps:**

- Verify control of the phone/identity before recording consent or honoring a public revocation, or document another trusted authorization mechanism.
- Validate tenant ownership, purpose, notice/version, locale, timestamp, and evidence for each consent record.
- Define how an individual submits and verifies access, rectification, erasure, and portability requests.
- Implement a status/reviewer workflow for each request type, including requested, identity-verified, in-progress, fulfilled/rejected, and audit details.
- Link fulfillment actions/reports to the request and record who handled it and when.

These are product/compliance policy decisions as well as implementation work. Do not treat caller-supplied identifiers alone as proof of a data subject's identity.

**Relevant code:** `src/modules/pdpl/pdpl.controller.ts`, `src/modules/pdpl/pdpl.service.ts`, `prisma/schema.prisma` (`DataRequest`, `ConsentLog`).

### Breach response process

**Current flow:** A super admin can create a breach record. For high/critical severity, the `notifySdaia` path currently logs that notification is required; it does not submit a regulator notification or create a tracked follow-up.

**Missing flow steps:**

- Define severity criteria, incident owner, required facts, and response deadlines.
- Track assessment, containment, affected data subjects, regulator decision/notification, corrective actions, and resolution.
- Record notification attempts, outcomes, timestamps, and evidence rather than only writing a log line.
- Ensure breach records and attached evidence are access-controlled and auditable.

**Relevant code:** `src/modules/pdpl/pdpl.service.ts`, `src/modules/pdpl/pdpl.controller.ts`, `prisma/schema.prisma` (`BreachLog`).

## P1: Define And Close The Main Operational Flows

### Order creation and status history

Order creation writes the order and then writes initial history separately. Driver status updates also write the order state and history in separate operations. A history failure can leave a changed order with incomplete audit history.

**Missing flow step:** Make the order mutation and required history entry one transaction. Define whether outbound event creation belongs in that same transaction through an outbox.

**Relevant code:** `src/modules/orders/orders.service.ts` (`create`, `updateStatus`, `cancel`).

### Manual assignment notifications

Automatic assignment sends the driver a push notification; manual assignment updates order/driver state and dispatches a webhook/customer SMS but does not call the driver push notification path.

**Missing flow step:** Decide whether manual and automatic assignment must produce the same driver-facing notification and implement one shared event path if they do. Specify whether the API returns success when push is unavailable.

**Relevant code:** `src/modules/orders/orders.service.ts` (`assignDriver`), `src/modules/orders/orders-assignment.service.ts` (`autoAssign`).

### Notification language preference

Driver records have a saved `lang`, but new-order/new-return/cancellation notification callers do not pass that preference to the notification builder. The builder defaults to Arabic, so an English-preferring driver may receive Arabic text.

**Missing flow step:** Read and pass the driver's saved language for every asynchronous push event; define what happens when the preference is absent or unsupported.

**Relevant code:** `src/modules/notifications/notifications.service.ts`, `src/modules/orders/orders-assignment.service.ts`, `src/modules/returns/returns.service.ts`, `prisma/schema.prisma` (driver language field).

### Return assignment and lifecycle consistency

Return assignment checks for a busy driver but does not require `AVAILABLE`, and it updates return/driver state before writing history separately. This differs from the conditional atomic claim used by order assignment.

**Missing flow steps:**

- Define whether offline drivers can receive returns; use one eligible-driver rule for manual and automatic workflows.
- Atomically claim an available driver, pending return, and history entry so concurrent assignments cannot double-book a driver.
- Define the completed-return behavior for the original order and whether a completed return can be reopened or replaced.
- Define what warehouse evidence is mandatory and how an upload failure affects OTP completion.

**Relevant code:** `src/modules/returns/returns.service.ts` (`assignDriver`, `verifyWarehouseOtp`, `cancel`).

### User lifecycle and account recovery

Authentication provides login, refresh, and current-user details. The `UsersController` and `UsersService` currently have no user-management operations, and there is no password-change, reset, invitation, or account-recovery flow.

**Decisions required:**

- Which roles may invite/create, disable, or remove tenant users?
- How are credentials delivered and first login verified?
- How does a user rotate a password or recover an account without exposing account existence?
- What happens to refresh tokens and active sessions after password, role, user, driver, or tenant status changes?

**Relevant code:** `src/modules/auth/auth.controller.ts`, `src/modules/users/users.controller.ts`, `src/modules/users/users.service.ts`.

### Public tracking privacy contract

Public tracking uses the tracking code as its only lookup credential and returns recipient name/address, driver name/vehicle, status history notes, and (in transit) driver location. The endpoint is rate-limited, but the privacy and retention policy for this disclosure is not encoded in the flow.

**Decision required:** Define the minimum public response, which fields are exposed at each state, whether a separate PIN/verification is required, how long tracking codes remain valid, and how customers can disable or revoke public tracking. Review status-history notes before exposing them publicly.

**Relevant code:** `src/modules/tracking/tracking.service.ts`, `src/modules/orders/orders.service.ts` (`trackByCode`), `src/modules/orders/orders.controller.ts`.

### Personal-data access audit trail

A `DataAccessLog` model and `PdplService.logDataAccess()` method exist, but the method currently has no callers. Sensitive reads/exports therefore do not flow through the audit writer.

**Missing flow step:** Identify which reads and exports must be audited, call the logger consistently (prefer an interceptor/service boundary that has authenticated actor, tenant, resource, action, IP, and user agent), and define retention/tamper-access controls.

**Relevant code:** `src/modules/pdpl/pdpl.service.ts`, `prisma/schema.prisma` (`DataAccessLog`).

### Photo retention coverage

The retention job removes old delivery-photo objects and clears order references. It does not currently process return-product photo keys even though return photos have their own retention period and storage key.

**Missing flow step:** Add return-photo expiration and reference cleanup, define behavior for storage deletion failures, and ensure database records do not claim a file exists after successful deletion.

**Relevant code:** `src/modules/pdpl/pdpl.service.ts` (`cleanupDeliveryPhotos`), `src/common/constants/retention.constants.ts`, `prisma/schema.prisma` (`ReturnRequest.productPhotoKey`).

## P2: Product And Operations Decisions

### Tenant API integration contract

A Passport API-key strategy exists but route-level use is not defined. The generated tenant API secret is not part of the visible strategy validation, which currently authenticates by API key alone.

**Decision required:** Choose API-key-only versus key/secret signing, list permitted endpoints, define rotation overlap/revocation behavior, and specify whether API access is read-only or may create/update orders. Then document the contract and test tenant scoping and usage accounting.

### Tenant plans and entitlements

Tenants have plan values and API rate limits, but the end-to-end lifecycle for selecting/upgrading a plan, enforcing other entitlements, suspending on expiry, and recording usage/billing is not defined in these flows.

**Decision required:** Decide whether plans are labels/rate-limit tiers only or represent billable subscriptions. Implement subscription/payment lifecycle only if the product requires it.

### Driver location lifecycle

The client is expected to send frequent coordinates. The API updates the driver row for every location event and emits a live update; there is no documented stale-location policy, sampling/retention model, or fallback when Redis/socket delivery is unavailable.

**Decision required:** Define accepted update frequency, stale thresholds, persistence/downsampling policy, location visibility by order state, and behavior for disconnected clients.

## Suggested Closure Order

1. Complete the SMS provider/test strategy so the delivery and return OTP flows can finish.
2. Define the tenant API-key contract and the PDPL consent/data-request/breach policies.
3. Make business state, status history, and outbox-event creation atomic; unify order and return driver-claim rules.
4. Complete user lifecycle, push-language, public tracking, data-access audit, and return-photo retention flows.
5. Add e2e workflows that exercise the agreed decisions and failure paths.
