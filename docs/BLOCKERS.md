# Project Blockers And Follow-Ups

Status: 2026-09-28

This document separates features that cannot currently work as expected from reliability and maintenance risks that need a decision or more evidence. It is not a list of already-resolved issues.

## Blocks Real SMS And OTP Delivery

**Status:** Blocking SMS/OTP workflows.

`SmsService` currently creates an SMS log, marks it `failed`, and returns `provider_unavailable`; it does not call an SMS provider. As a result, order-delivery and warehouse-return OTP endpoints intentionally return service unavailable and clear the generated OTP. `SMS_PROVIDER` and `SMS_API_KEY` are present in `.env.example`, but the service does not use them.

**Next actions:**

- Confirm the SMS provider and its supported API/authentication contract.
- Implement the provider adapter with request timeout, response/error handling, provider message ID, and delivery-state logging.
- Keep OTP and phone values out of logs.
- Test provider success, rejection, timeout, retry behavior, Arabic/English templates, and OTP cleanup on failed send.

**Acceptance:** An OTP request reports success only after provider acceptance; failure leaves no usable OTP and is traceable through a redacted SMS log.

## API-Key Authentication Is Not Wired To Routes

**Status:** Blocking tenant API-key clients if API-key access is part of the supported API contract.

`ApiKeyStrategy` is registered in `AuthModule`, but no route/guard invokes the `api-key` Passport strategy. `ApiKeyRateLimitGuard` is also not registered on routes or in the global guard chain. The current protected routes use JWT authentication.

**Decision required:** Identify which endpoints should accept tenant API keys and which should remain JWT-only. Do not globally enable API-key auth without defining route and role boundaries.

**Next actions:**

- Add a dedicated API-key guard and apply it only to the agreed tenant endpoints, or remove API-key support claims from docs if it is not intended.
- Define the request principal shape and ensure tenant scoping is enforced for every such endpoint.
- Test valid, invalid, rotated, and inactive-tenant keys; cross-tenant access; allowed endpoint matrix; and rate limiting.

**Acceptance:** The documented API-key workflow succeeds on the approved routes and is rejected everywhere else.

## External Side Effects Are Not Durable

**Status:** Reliability risk; can return an error after a database update has committed.

Order/return mutations commit before webhook, SMS, push-notification, or queue work completes. Webhook logs and Bull queue insertion are also separate operations. If Redis or an external provider fails after the business transaction, the API may report failure even though the order state changed, or the event may never be delivered.

**Next actions:**

- Add a transactional outbox row in the same database transaction as each business mutation.
- Publish outbox rows asynchronously with retries and idempotency keys.
- Track attempts, final failure, and replay/operations visibility.
- Test crash/failure between commit and publish, duplicate processing, retry, and eventual delivery.

**Acceptance:** Every committed business event is either delivered or visibly retryable; repeated processing cannot duplicate the business transition.

## E2E Tests Are Not In CI

**Status:** Coverage gap.

The CI workflow runs typecheck, build, unit tests, and migration/schema checks, but does not run `npm run test:e2e`. The local e2e smoke test passes, but authenticated workflows and local/CI parity are not gated.

**Next actions:**

- Add a dedicated e2e CI job with PostgreSQL and Redis services and isolated test configuration.
- Avoid using developer `.env` credentials or the local development database in CI.
- Add smoke flows for login, tenant isolation, order lifecycle, and return lifecycle.

**Acceptance:** Pull requests run the e2e suite against disposable services and leave no open handles.

## Webhook Lint Debt

**Status:** Maintenance/quality gate gap.

CI runs ESLint as informational (`continue-on-error: true`). The current webhook service and processor contain unsafe `any` payload/error handling and unused destructured OTP fields, so lint cannot yet be treated as a blocking gate.

**Next actions:**

- Type webhook payloads and Axios errors; validate persisted JSON before retrying jobs.
- Remove unused destructuring while continuing to omit OTP fields from payloads.
- Add an ESLint check script without `--fix`, resolve repository lint debt in manageable slices, then make CI lint blocking.

**Acceptance:** `yarn eslint "{src,apps,libs,test}/**/*.ts"` exits successfully without modifying files.

## Query Performance Needs Representative Data

**Status:** Needs measurement; not yet a confirmed production bottleneck.

Order listing performs a paginated query and exact count, while filters/search may need indexes. Adding indexes without production-like measurements can slow writes and increase storage without helping actual queries.

**Next actions:**

- Capture `EXPLAIN ANALYZE` for common per-tenant list, status/date filters, and search queries using representative row counts and distributions.
- Record latency and query plans before changing the schema.
- Add only indexes justified by measured plans, then compare read and write costs.
- Benchmark bulk assignment and high-frequency driver location updates at realistic tenant sizes.

**Acceptance:** Query changes include before/after plans or benchmarks and a migration test for the selected indexes.

## Environment And Local Testing Notes

- The return-history migration has been applied to the local development database and is included in CI migration/schema checks as of this status. Do not reset a database to address these remaining blockers.
- `.env` is local and ignored by Git. Keep provider credentials there or in a secret manager; never add them to tracked examples.
- Manual Postman order/driver workflows can use JWT login without SMS, but OTP completion cannot be exercised end-to-end until an SMS provider is integrated or a deliberately test-only provider/fake is configured.
