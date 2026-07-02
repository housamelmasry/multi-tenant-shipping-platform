# Shipping API - Local Development Commands

## Install dependencies

``` bash
yarn
```

------------------------------------------------------------------------

## Start PostgreSQL (Homebrew)

``` bash
brew services start postgresql@18
```

Check status:

``` bash
brew services list
```

Check database is accepting connections:

``` bash
pg_isready
```

------------------------------------------------------------------------

## Connect to PostgreSQL

``` bash
psql -U postgres
```

Connect to the project database:

``` bash
psql -U postgres -d shipping_db
```

List databases:

``` sql
\l
```

List tables:

``` sql
\dt
```

Exit:

``` sql
\q
```

------------------------------------------------------------------------

## Prisma

Generate Prisma Client:

``` bash
npx prisma generate
```

Create/apply migrations:

``` bash
npx prisma migrate dev --name init
```

Reset database and re-run all migrations:

``` bash
npx prisma migrate reset
```

Sync schema from an existing database (Database First only):

``` bash
npx prisma db pull
```

Open Prisma Studio:

``` bash
npx prisma studio
```

------------------------------------------------------------------------

## Seed Database

``` bash
yarn seed
```

or

``` bash
npm run seed
```

------------------------------------------------------------------------

## Run the API

Development:

``` bash
yarn start:dev
```

Production build:

``` bash
yarn build
```

Run production build:

``` bash
yarn start:prod
```

------------------------------------------------------------------------

## Useful Yarn Scripts

``` bash
yarn db:fresh
```

Runs:

-   prisma migrate dev
-   seed

``` bash
yarn db:reset
```

Runs:

-   prisma migrate reset --force
-   seed

Create Admin User:

``` bash
yarn admin:create
```

------------------------------------------------------------------------

## Environment

``` env
DATABASE_URL="postgresql://postgres:123456@localhost:5432/shipping_db"
```

------------------------------------------------------------------------

## Demo Credentials

### Super Admin

-   Email: admin@shipping.com
-   Password: Admin@123456

### Tenant Manager

-   Email: manager@demo-shipping.com
-   Password: Admin@123456
