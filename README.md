<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

# Shipping Management API

A multi-tenant shipping backend built with NestJS, TypeScript, PostgreSQL, and Prisma. This portfolio project models order and return lifecycles, driver assignment, OTP-based proof workflows, tenant-scoped APIs, and outbound webhooks.

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
