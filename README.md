# Shipping Management API

Multi-tenant shipping backend built with NestJS, TypeScript, PostgreSQL, and Prisma.

**Project Status:** Originally developed as a client engagement that ended before production launch, this implementation is now maintained independently as a portfolio project. It is not a production system and is not feature-complete.

## Engineering Areas

- JWT authentication, role-based access, and tenant separation.
- Order and return state transitions, driver assignment, and status history.
- Redis-backed queues, real-time notifications, and outbound webhook delivery.
- Arabic and English localization, image processing/storage, and PDPL-oriented technical controls.

## Project Docs

- [Architecture](ARCHITECTURE.md)
- [API endpoints](API_ENDPOINTS.md)
- [Local setup](SETUP.md)
- [Business-flow gaps](docs/LOGIC_FLOW_GAPS.md)
- [Test plan](docs/TEST_PLAN.md)
- [MIT License](LICENSE)

## Local Checks

Install dependencies and configure the environment as described in [SETUP.md](SETUP.md). Useful checks:

```bash
npm run typecheck
npm test -- --runInBand
npm run build
npm run test:e2e
```

## Known Limitations / Not Implemented

- **SMS and OTP:** The SMS service is a stub with no real provider wired, so OTP sending fails by design and normal customer/warehouse OTP workflows cannot complete.
- **External side effects:** There is no transactional outbox; webhook, push, and SMS dispatch are best-effort and are not guaranteed atomic with business-state changes.
- **PDPL scope:** The module provides PDPL-oriented technical controls, including logging and anonymization scaffolding, but does not verify identity for public consent/revoke, implement the full data-subject request lifecycle, or send real SDAIA breach notifications; this project does not claim regulatory compliance.
- **Account lifecycle:** Authentication provides login and refresh only; password reset and user-invite flows are not implemented.
- **Tenant API keys:** The API-key strategy exists but is not applied to routes; the current protected workflows use JWT authentication.
- **E2E CI coverage:** Local e2e tests exist, but the CI workflow does not run or gate them.
- **Scale validation:** The project has no load testing or query-plan-based indexing work and has not been benchmarked at scale.
