# Shipping API - Local Development Commands

## Install dependencies

```bash
yarn
```

---

## Start PostgreSQL (Homebrew)

```bash
brew services start postgresql@18
```

Check status:

```bash
brew services list
```

Check database is accepting connections:

```bash
pg_isready
```

---

## Connect to PostgreSQL

```bash
psql -U postgres
```

Connect to the project database:

```bash
psql -U postgres -d shipping_db
```

List databases:

```sql
\l
```

List tables:

```sql
\dt
```

Exit:

```sql
\q
```

---

## Prisma

Generate Prisma Client:

```bash
npx prisma generate
```

Create/apply migrations:

```bash
npx prisma migrate dev --name init
```

Reset database and re-run all migrations:

```bash
npx prisma migrate reset
```

Sync schema from an existing database (Database First only):

```bash
npx prisma db pull
```

Open Prisma Studio:

```bash
npx prisma studio
```

---

## Seed Database

```bash
yarn seed
```

or

```bash
npm run seed
```

---

## Run the API

Development:

```bash
yarn start:dev
```

Production build:

```bash
yarn build
```

Run production build:

```bash
yarn start:prod
```

---

## Useful Yarn Scripts

```bash
yarn db:fresh
```

Runs:

- prisma migrate dev
- seed

```bash
yarn db:reset
```

Runs:

- prisma migrate reset --force
- seed

Create Admin User:

```bash
yarn admin:create
```

---

## Environment

Copy `.env.example` to `.env` and set the required database URL, JWT secret, and unique seed passwords.

---

## Seed Accounts

The seed reads credentials from `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`, `DEMO_TENANT_ADMIN_PASSWORD`, and `DEMO_DRIVER_PASSWORD`. It does not print passwords; use the configured values to sign in.
