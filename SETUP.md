# Setup Guide

## Prerequisites

- **Node.js** >= 18
- **Yarn** (`npm install -g yarn`)
- **PostgreSQL** running locally (e.g., via [Postgres.app](https://postgresapp.com/) or `brew install postgresql`)
- **Redis** running locally (`brew install redis && brew services start redis`)

---

## 1. Environment Variables

Create a local `.env` file from the example and set unique credentials:

```bash
cp .env.example .env
```

Required values include:

| Variable                                     | Description                                                            |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| `DATABASE_URL`                               | PostgreSQL connection string                                           |
| `JWT_SECRET`                                 | Random JWT signing secret; generate one with `openssl rand -base64 32` |
| `SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` | Initial super-admin account                                            |
| `DEMO_TENANT_ADMIN_PASSWORD`                 | Development demo tenant-admin password                                 |
| `DEMO_DRIVER_PASSWORD`                       | Development demo driver password                                       |

The demo tenant is seeded only when `NODE_ENV=development`. Keep `.env` local and never commit it.

---

## 2. Install Dependencies

```bash
yarn install
```

---

## 3. Setup PostgreSQL Database

### 3.1 Create the Database

```bash
# Connect to PostgreSQL and create the database
psql postgres -c "CREATE DATABASE shipping_db;"

# If you need a different user, create one:
psql postgres -c "CREATE USER root WITH PASSWORD 'password';"
psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE shipping_db TO root;"
```

Or via the interactive `psql` shell:

```bash
psql postgres
# Then run:
#   CREATE DATABASE shipping_db;
#   \q
```

### 3.2 Run Migrations

```bash
# Apply all pending migrations
npx prisma migrate dev
```

To name the migration (first time or new migration):

```bash
npx prisma migrate dev --name init
```

### 3.3 Generate Prisma Client

```bash
npx prisma generate
```

### 3.4 Seed the Database

```bash
yarn seed
```

---

## 4. Start the Server

```bash
# Development (with hot-reload)
yarn start:dev

# Production build
yarn build && yarn start:prod

# Debug mode
yarn start:debug
```

The API will be available at: `http://localhost:3000/api/v1`

Swagger docs: `http://localhost:3000/docs`

---

## 5. Useful Commands

### Database

| Command                                | Description                                        |
| -------------------------------------- | -------------------------------------------------- |
| `yarn db:fresh`                        | Drop all tables, re-run all migrations, then seed  |
| `yarn db:reset`                        | Reset database and seed (prompts for confirmation) |
| `npx prisma studio`                    | Open Prisma Studio (GUI DB browser)                |
| `npx prisma migrate dev --name <name>` | Create a new migration after schema changes        |
| `npx prisma migrate deploy`            | Apply migrations in production                     |

### Admin

| Command             | Description                       |
| ------------------- | --------------------------------- |
| `yarn admin:create` | Create a new super admin from CLI |

### Code Quality

| Command         | Description          |
| --------------- | -------------------- |
| `yarn build`    | Compile the project  |
| `yarn lint`     | Lint and fix code    |
| `yarn test`     | Run unit tests       |
| `yarn test:e2e` | Run end-to-end tests |

---

## Quick Start (First Time)

```bash
yarn install                      # 1. Install deps
npx prisma migrate dev --name init  # 2. Create tables
yarn seed                          # 3. Seed data
yarn start:dev                     # 4. Start server
```
