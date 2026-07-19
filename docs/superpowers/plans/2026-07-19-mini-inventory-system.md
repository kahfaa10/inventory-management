# Mini Inventory Management System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved internal Mini Inventory Management System as a tested full-stack Nuxt 4 monolith with an immutable PostgreSQL stock ledger.

**Architecture:** Nuxt pages and composables call authenticated Nitro REST routes. Routes validate shared Zod DTOs and delegate to focused server services; inventory services use Prisma interactive transactions, PostgreSQL transaction locks, and immutable `stock_movements`. Report tables and Excel exports share the same report-query services.

**Tech Stack:** Node.js 22 LTS, pnpm, Nuxt 4, TypeScript, Nuxt UI 4 with Tailwind CSS, PostgreSQL, Prisma ORM 7 with `@prisma/adapter-pg`, `nuxt-auth-utils`, Argon2, Zod, ExcelJS, Vitest, Nuxt Test Utils, Playwright, Docker Compose, and Docker.

## Global Constraints

- Use Nuxt 4 for frontend pages, routing, middleware, and server APIs.
- Use Nitro server routes as the backend; do not create Express, NestJS, GraphQL, microservices, Redis, queues, or a separate backend.
- Use Node.js 22 LTS and pnpm.
- Keep Prisma and all database access inside the Nuxt server layer.
- Use `stock_movements` as the immutable source of truth; never add an independently editable stock field.
- Post, reverse, validate, and update status atomically inside database transactions.
- Use the approved Device Detail uniqueness rule `(device_id, part_number, dpn)` with null-safe DP/N behavior.
- Preserve the BRD scope and exclude every feature listed as out of scope.
- Follow red-green-refactor: every production behavior starts with a test that is observed failing for the expected reason.
- Do not claim completion unless migration, tests, lint, format, typecheck, production build, Docker checks where available, and the sample scenario have fresh successful output.

## Current environment facts

- The repository is greenfield apart from documentation and the approved design spec.
- The current shell reports Node `v24.16.0`; execution must use a Node 22 environment before final verification.
- `pnpm` is not currently installed; enable the pinned pnpm version through Corepack or install pnpm before Task 1.
- Docker and Docker Compose are not currently installed; database-backed and container verification require Docker to be installed or a compatible PostgreSQL URL supplied.

## Planned file map

- `app/`: Nuxt UI application shell, feature pages, reusable form/report components, and server-state composables.
- `server/api/`: thin authenticated REST route handlers.
- `server/services/`: authentication, masters, numbering, stock, transactions, cancellations, returns, reports, and Excel logic.
- `server/repositories/`: transaction and report query composition only where it removes duplication.
- `server/utils/`: Prisma client, PostgreSQL locks, transaction retry, auth guards, DTO mapping, and API errors.
- `shared/`: enums, Zod schemas, DTOs, filters, constants, and validation copy.
- `prisma/`: schema, handwritten migration additions, generated-client configuration, and seed.
- `tests/`: unit, PostgreSQL integration, Nuxt route, and Playwright suites.

---

### Task 1: Scaffold Nuxt, Nuxt UI, package tooling, and the test harness

**Files:**

- Create: `package.json`
- Create: `pnpm-lock.yaml`
- Create: `pnpm-workspace.yaml`
- Create: `.npmrc`
- Create: `.nvmrc`
- Create: `.node-version`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `nuxt.config.ts`
- Create: `tsconfig.json`
- Create: `eslint.config.mjs`
- Create: `.prettierrc.json`
- Create: `.prettierignore`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `app/app.vue`
- Create: `app/assets/css/main.css`
- Create: `app/pages/index.vue`
- Create: `shared/constants/app.ts`
- Test: `tests/unit/app-constants.test.ts`

**Interfaces:**

- Produces: `APP_NAME`, `DEFAULT_PAGE_SIZE`, `MAX_PAGE_SIZE`, package scripts, Nuxt aliases, and separate `unit`, `nuxt`, and `integration` Vitest projects.
- Consumes: nothing.

- [ ] **Step 1: Create package metadata and install exact resolved dependencies**

Use package scripts with these stable names:

```json
{
  "scripts": {
    "dev": "nuxt dev",
    "build": "nuxt build",
    "preview": "node .output/server/index.mjs",
    "postinstall": "nuxt prepare",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "nuxt typecheck",
    "test": "vitest run",
    "test:unit": "vitest run --project unit",
    "test:nuxt": "vitest run --project nuxt",
    "test:integration": "vitest run --project integration",
    "test:e2e": "playwright test",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:deploy": "prisma migrate deploy",
    "db:seed": "prisma db seed"
  }
}
```

Install runtime packages with `pnpm add nuxt@^4 @nuxt/ui@^4 tailwindcss nuxt-auth-utils @prisma/client@^7 @prisma/adapter-pg pg argon2 zod exceljs` and development packages with `pnpm add -D prisma@^7 typescript vue-tsc @nuxt/eslint eslint prettier vitest @vitest/coverage-v8 @nuxt/test-utils @vue/test-utils happy-dom @playwright/test dotenv tsx @types/pg`.

- [ ] **Step 2: Write the failing foundation test**

```ts
import { describe, expect, it } from 'vitest'
import { APP_NAME, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../shared/constants/app'

describe('application constants', () => {
  it('uses bounded pagination defaults', () => {
    expect(APP_NAME).toBe('Mini Inventory')
    expect(DEFAULT_PAGE_SIZE).toBe(20)
    expect(MAX_PAGE_SIZE).toBe(100)
  })
})
```

- [ ] **Step 3: Run the test and observe the expected failure**

Run: `pnpm test:unit tests/unit/app-constants.test.ts`

Expected: FAIL because `shared/constants/app.ts` does not exist.

- [ ] **Step 4: Add minimal constants and Nuxt UI shell**

```ts
export const APP_NAME = 'Mini Inventory'
export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100
```

Configure `@nuxt/ui`, `nuxt-auth-utils`, and `@nuxt/eslint` modules; import `~/assets/css/main.css`; set compatibility date; expose session configuration only through runtime config. Wrap pages in `<UApp>`. The CSS imports must be exactly `@import "tailwindcss";` and `@import "@nuxt/ui";`.

- [ ] **Step 5: Verify the foundation**

Run: `pnpm test:unit tests/unit/app-constants.test.ts && pnpm typecheck && pnpm lint && pnpm format:check`

Expected: one passing test and zero type, lint, or formatting errors.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc .nvmrc .node-version .gitignore .env.example nuxt.config.ts tsconfig.json eslint.config.mjs .prettierrc.json .prettierignore vitest.config.ts playwright.config.ts app shared/constants/app.ts tests/unit/app-constants.test.ts
git commit -m "chore: scaffold Nuxt inventory application"
```

---

### Task 2: Define the PostgreSQL schema, migration, Prisma adapter, and test database utilities

**Files:**

- Create: `prisma.config.ts`
- Create: `prisma/schema.prisma`
- Create: `prisma/migrations/20260719000100_initial_schema/migration.sql`
- Create: `prisma/seed.ts`
- Create: `server/utils/prisma.ts`
- Create: `tests/helpers/database.ts`
- Create: `tests/integration/schema.test.ts`
- Create: `docker-compose.yml`
- Modify: `package.json`
- Modify: `.env.example`

**Interfaces:**

- Produces: `prisma`, `withCleanDatabase()`, Prisma enums/models, all foreign keys/check constraints/indexes, and PostgreSQL 17 local service.
- Consumes: package scripts from Task 1.

- [ ] **Step 1: Write a failing schema integration test**

```ts
import { describe, expect, it } from 'vitest'
import { prisma, withCleanDatabase } from '../helpers/database'

describe('inventory schema', () => {
  it('rejects duplicate null-DPN details within the same device', async () => {
    await withCleanDatabase(async () => {
      const device = await prisma.device.create({ data: { deviceName: 'Disk' } })
      await prisma.deviceDetail.create({
        data: { deviceId: device.id, partNumber: 'PN-1', specification: '600GB' },
      })
      await expect(
        prisma.deviceDetail.create({
          data: { deviceId: device.id, partNumber: 'PN-1', specification: 'Other' },
        }),
      ).rejects.toMatchObject({ code: 'P2002' })
    })
  })
})
```

- [ ] **Step 2: Run it and observe the expected failure**

Run: `pnpm test:integration tests/integration/schema.test.ts`

Expected: FAIL because Prisma schema, generated client, or migrated database is absent.

- [ ] **Step 3: Define the complete Prisma model graph**

Create enums `UserRole`, `TransactionStatus`, `TransactionType`, and `MovementPurpose`. Define `User`, `Model`, `ServiceTag`, `Customer`, `Device`, `DeviceDetail`, `Rack`, `TransactionCounter`, all six transaction tables, and `StockMovement`. Use `BigInt @id @default(autoincrement())`, mapped snake_case tables/columns, `DateTime @db.Date` business dates, and required relations from the design.

The migration must add these invariants Prisma cannot fully express:

```sql
CREATE UNIQUE INDEX device_details_identity_key
ON device_details (device_id, lower(part_number), lower(dpn)) NULLS NOT DISTINCT;

ALTER TABLE stock_adjustment_in_details
  ADD CONSTRAINT sai_quantity_positive CHECK (quantity > 0);
ALTER TABLE stock_release_details
  ADD CONSTRAINT srl_quantity_positive CHECK (released_quantity > 0);
ALTER TABLE stock_return_details
  ADD CONSTRAINT srt_quantity_positive CHECK (return_quantity > 0);
ALTER TABLE stock_movements
  ADD CONSTRAINT stock_movement_one_side_positive CHECK (
    (quantity_in > 0 AND quantity_out = 0)
    OR (quantity_out > 0 AND quantity_in = 0)
  );
```

Add case-insensitive unique indexes for master names/codes/tags and indexes for `(device_detail_id, rack_id, transaction_date, created_at)`, customer reports, source movement identity, and return-detail aggregation.

- [ ] **Step 4: Configure Prisma 7 and PostgreSQL adapter**

```ts
import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../generated/prisma/client'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })

export const prisma = new PrismaClient({ adapter })
```

Configure the generator output as `../generated/prisma` and place the migration URL in `prisma.config.ts`. Configure PostgreSQL 17 in Compose with a health check and a named data volume.

After the schema exists, update `package.json` so `postinstall` is `nuxt prepare && prisma generate`; this avoids invoking Prisma generation before Task 2 creates `prisma/schema.prisma`.

- [ ] **Step 5: Migrate and verify the schema**

Run: `docker compose up -d db && pnpm db:generate && pnpm db:deploy && pnpm test:integration tests/integration/schema.test.ts`

Expected: migration succeeds and the duplicate null-DP/N test passes.

- [ ] **Step 6: Commit**

```bash
git add prisma.config.ts prisma server/utils/prisma.ts tests/helpers/database.ts tests/integration/schema.test.ts docker-compose.yml .env.example package.json
git commit -m "feat: add inventory database schema"
```

---

### Task 3: Implement authentication, sessions, and role guards

**Files:**

- Create: `shared/schemas/auth.ts`
- Create: `shared/types/auth.d.ts`
- Create: `server/services/auth.service.ts`
- Create: `server/utils/auth.ts`
- Create: `server/utils/api-error.ts`
- Create: `server/plugins/session.ts`
- Create: `server/api/auth/login.post.ts`
- Create: `server/api/auth/logout.post.ts`
- Create: `app/middleware/auth.global.ts`
- Create: `app/pages/login.vue`
- Create: `tests/integration/auth.service.test.ts`
- Create: `tests/nuxt/auth-routes.test.ts`
- Modify: `prisma/seed.ts`

**Interfaces:**

- Produces: `loginSchema`, `authenticateUser(credentials)`, `requireAppUser(event)`, `requireRole(event, roles)`, `ApiError`, and typed `UserSession`.
- Consumes: `prisma` and `UserRole` from Task 2.

- [ ] **Step 1: Write failing password and authorization tests**

```ts
it('authenticates an active user without exposing the password hash', async () => {
  const user = await createUser({ password: 'Correct-Horse-123!' })
  const result = await authenticateUser({ email: user.email, password: 'Correct-Horse-123!' })
  expect(result).toEqual({ id: user.id.toString(), email: user.email, name: user.name, role: 'USER' })
  expect(result).not.toHaveProperty('passwordHash')
})

it('rejects an inactive user', async () => {
  const user = await createUser({ isActive: false })
  await expect(authenticateUser({ email: user.email, password: TEST_PASSWORD })).rejects.toMatchObject({
    statusCode: 401,
    code: 'INVALID_CREDENTIALS',
  })
})
```

- [ ] **Step 2: Verify red**

Run: `pnpm test:integration tests/integration/auth.service.test.ts`

Expected: FAIL because `authenticateUser` is missing.

- [ ] **Step 3: Implement authentication and session guards**

Use `argon2.hash` in the seed/test factory and `argon2.verify` at login. Normalize email with `trim().toLowerCase()`. Return the same 401 response for unknown email, incorrect password, and inactive user. `requireAppUser` must load the current user by session ID and reject a deactivated account even when its cookie remains valid.

At login call:

```ts
await setUserSession(event, {
  user: { id: user.id, email: user.email, name: user.name, role: user.role },
  loggedInAt: new Date().toISOString(),
})
```

Add an `ADMIN_EMAIL`, `ADMIN_NAME`, and `ADMIN_PASSWORD` environment-driven idempotent seed.

- [ ] **Step 4: Add and run Nitro route tests**

Test successful login, generic invalid login, sealed session access, logout, anonymous 401, User 403, and Admin success.

Run: `pnpm test:integration tests/integration/auth.service.test.ts && pnpm test:nuxt tests/nuxt/auth-routes.test.ts`

Expected: all authentication and role tests pass.

- [ ] **Step 5: Commit**

```bash
git add shared/schemas/auth.ts shared/types/auth.d.ts server/services/auth.service.ts server/utils/auth.ts server/utils/api-error.ts server/plugins/session.ts server/api/auth app/middleware/auth.global.ts app/pages/login.vue tests/integration/auth.service.test.ts tests/nuxt/auth-routes.test.ts prisma/seed.ts
git commit -m "feat: add cookie session authentication"
```

---

### Task 4: Implement shared validation, pagination, DTO mapping, and master services

**Files:**

- Create: `shared/enums/inventory.ts`
- Create: `shared/schemas/common.ts`
- Create: `shared/schemas/masters.ts`
- Create: `shared/types/api.ts`
- Create: `shared/types/masters.ts`
- Create: `shared/validation/messages.ts`
- Create: `server/utils/validation.ts`
- Create: `server/utils/prisma-errors.ts`
- Create: `server/utils/dto.ts`
- Create: `server/services/master.service.ts`
- Test: `tests/unit/master-schemas.test.ts`
- Test: `tests/integration/master.service.test.ts`

**Interfaces:**

- Produces: six create/update schemas, `listQuerySchema`, `parseBody`, `parseQuery`, `serializeBigInts`, `MasterService<T>`, and structured duplicate/inactive errors.
- Consumes: Prisma client, API error, constants.

- [ ] **Step 1: Write failing validation and uniqueness tests**

```ts
it.each(['', '   '])('rejects blank model name %j', (modelName) => {
  expect(modelCreateSchema.safeParse({ modelName }).success).toBe(false)
})

it('rejects model names case-insensitively', async () => {
  await modelService.create(adminId, { modelName: 'PowerEdge R750' })
  await expect(modelService.create(adminId, { modelName: 'poweredge r750' })).rejects.toMatchObject({
    code: 'DUPLICATE_RECORD',
  })
})
```

Cover duplicate Model Name, Service Tag, Device Name, Customer Name, Rack Code, required Part Number and Specification, and the approved Device Detail identity.

- [ ] **Step 2: Verify red**

Run: `pnpm test:unit tests/unit/master-schemas.test.ts && pnpm test:integration tests/integration/master.service.test.ts`

Expected: FAIL because schemas and services are missing.

- [ ] **Step 3: Implement schemas and focused services**

Create explicit functions `listModels`, `createModel`, `updateModel`, and corresponding functions for the other five resources. Every create/update accepts a picked Zod DTO and never spreads raw request bodies. Service Tag validation loads its Model and optional Customer. Device Detail validation loads its Device. Updates retain historical inactive relations but reject assigning inactive parents.

Return lists in this form:

```ts
interface PaginatedResponse<T> {
  data: T[]
  page: number
  pageSize: number
  total: number
}
```

- [ ] **Step 4: Run master tests**

Run: `pnpm test:unit tests/unit/master-schemas.test.ts && pnpm test:integration tests/integration/master.service.test.ts`

Expected: all master validation, relationship, pagination, and duplicate tests pass.

- [ ] **Step 5: Commit**

```bash
git add shared server/utils/validation.ts server/utils/prisma-errors.ts server/utils/dto.ts server/services/master.service.ts tests/unit/master-schemas.test.ts tests/integration/master.service.test.ts
git commit -m "feat: add master data services and validation"
```

---

### Task 5: Add master APIs and Nuxt UI pages

**Files:**

- Create: `server/api/models/index.get.ts`
- Create: `server/api/models/index.post.ts`
- Create: `server/api/models/[id].get.ts`
- Create: `server/api/models/[id].put.ts`
- Create: `server/api/service-tags/index.get.ts`
- Create: `server/api/service-tags/index.post.ts`
- Create: `server/api/service-tags/[id].get.ts`
- Create: `server/api/service-tags/[id].put.ts`
- Create: `server/api/devices/index.get.ts`
- Create: `server/api/devices/index.post.ts`
- Create: `server/api/devices/[id].get.ts`
- Create: `server/api/devices/[id].put.ts`
- Create: `server/api/device-details/index.get.ts`
- Create: `server/api/device-details/index.post.ts`
- Create: `server/api/device-details/[id].get.ts`
- Create: `server/api/device-details/[id].put.ts`
- Create: `server/api/customers/index.get.ts`
- Create: `server/api/customers/index.post.ts`
- Create: `server/api/customers/[id].get.ts`
- Create: `server/api/customers/[id].put.ts`
- Create: `server/api/racks/index.get.ts`
- Create: `server/api/racks/index.post.ts`
- Create: `server/api/racks/[id].get.ts`
- Create: `server/api/racks/[id].put.ts`
- Create: `app/layouts/default.vue`
- Create: `app/components/AppSidebar.vue`
- Create: `app/components/PageHeader.vue`
- Create: `app/components/masters/MasterList.vue`
- Create: `app/components/masters/MasterFormModal.vue`
- Create: `app/composables/useMasterResource.ts`
- Create: `app/pages/master/models.vue`
- Create: `app/pages/master/service-tags.vue`
- Create: `app/pages/master/devices.vue`
- Create: `app/pages/master/device-details.vue`
- Create: `app/pages/master/customers.vue`
- Create: `app/pages/master/racks.vue`
- Test: `tests/nuxt/master-api.test.ts`
- Test: `tests/nuxt/master-pages.test.ts`

**Interfaces:**

- Produces: authenticated REST APIs and all six master screens.
- Consumes: Task 3 guards and Task 4 services/schemas.

- [ ] **Step 1: Write failing route authorization tests**

```ts
it('allows Admin and forbids User from creating a rack', async () => {
  expect((await adminFetch('/api/racks', { method: 'POST', body: { rackCode: 'A', rackName: 'Rack A' } })).rackCode).toBe('A')
  await expect(userFetch('/api/racks', { method: 'POST', body: { rackCode: 'B', rackName: 'Rack B' } })).rejects.toMatchObject({ statusCode: 403 })
})
```

- [ ] **Step 2: Verify red**

Run: `pnpm test:nuxt tests/nuxt/master-api.test.ts`

Expected: FAIL with missing route.

- [ ] **Step 3: Implement thin route handlers**

Every write route calls `requireRole(event, ['ADMIN'])`, validates exact DTO fields, passes `session.user.id` to its service where needed, and maps service output through DTO serialization. Read routes call `requireAppUser` and support `search`, `page`, `pageSize`, `isActive`, and required parent filters.

- [ ] **Step 4: Build shared list/form UI and all pages**

Use `UTable`, `UInput`, `USelect`, `UModal`, `UForm`, `UFormField`, `USwitch`, `UPagination`, `UButton`, and toast feedback. Pages provide resource-specific columns and fields. Service Tags filter Model/Customer; Device Details filter Device. Hide create/edit actions for `USER`.

- [ ] **Step 5: Verify API and UI**

Run: `pnpm test:nuxt tests/nuxt/master-api.test.ts tests/nuxt/master-pages.test.ts && pnpm typecheck && pnpm lint`

Expected: all route/page tests pass and no type or lint errors remain.

- [ ] **Step 6: Commit**

```bash
git add server/api app/layouts app/components app/composables/useMasterResource.ts app/pages/master tests/nuxt/master-api.test.ts tests/nuxt/master-pages.test.ts
git commit -m "feat: add master data APIs and pages"
```

---

### Task 6: Implement numbering, stock balance, transaction retries, and locks

**Files:**

- Create: `shared/types/stock.ts`
- Create: `server/services/transaction-number.service.ts`
- Create: `server/services/stock.service.ts`
- Create: `server/utils/transaction.ts`
- Create: `server/utils/stock-lock.ts`
- Create: `server/api/stock/balance.get.ts`
- Test: `tests/unit/transaction-number.test.ts`
- Test: `tests/integration/stock.service.test.ts`
- Test: `tests/nuxt/stock-balance-api.test.ts`

**Interfaces:**

- Produces: `nextTransactionNumber(tx, type, date)`, `getStockBalance(client, deviceDetailId, rackId)`, `lockStockKeys(tx, keys)`, `runInventoryTransaction(operation)`, and balance API.
- Consumes: Prisma transaction client and ledger schema.

- [ ] **Step 1: Write failing format, balance, and lock tests**

```ts
expect(formatTransactionNumber('SAI', new Date('2026-07-19'), 1)).toBe('SAI-202607-0001')

it('sums ledger movements by item and rack', async () => {
  await movements(itemA, rackA, [{ in: 10, out: 0 }, { in: 0, out: 3 }, { in: 1, out: 0 }])
  expect(await getStockBalance(prisma, itemA, rackA)).toBe(8)
})
```

Add a concurrent numbering test that requests two numbers in the same month and expects distinct sequential values.

- [ ] **Step 2: Verify red**

Run: `pnpm test:unit tests/unit/transaction-number.test.ts && pnpm test:integration tests/integration/stock.service.test.ts`

Expected: FAIL because services are absent.

- [ ] **Step 3: Implement atomic counter and stock locks**

Use an upsert that increments and returns the counter inside the caller's transaction. Advisory locking must use `pg_advisory_xact_lock` with two signed 32-bit components derived from Device Detail and Rack IDs, with sorted unique pairs:

```ts
await tx.$executeRaw`SELECT pg_advisory_xact_lock(${deviceKey}, ${rackKey})`
```

`runInventoryTransaction` uses a short interactive transaction, Serializable isolation, and at most three retries for Prisma `P2034` conflicts.

- [ ] **Step 4: Verify utilities and API**

Run: `pnpm test:unit tests/unit/transaction-number.test.ts && pnpm test:integration tests/integration/stock.service.test.ts && pnpm test:nuxt -- tests/nuxt/stock-balance-api.test.ts`

Expected: formatting, concurrent numbering, ledger sum, and authenticated balance lookup pass.

- [ ] **Step 5: Commit**

```bash
git add shared/types/stock.ts server/services/transaction-number.service.ts server/services/stock.service.ts server/utils/transaction.ts server/utils/stock-lock.ts server/api/stock tests/unit/transaction-number.test.ts tests/integration/stock.service.test.ts tests/nuxt/stock-balance-api.test.ts
git commit -m "feat: add ledger balance and locking utilities"
```

---

### Task 7: Implement Stock Adjustment In backend with posting and reversal

**Files:**

- Create: `shared/schemas/stock-adjustment-in.ts`
- Create: `shared/types/transactions.ts`
- Create: `server/repositories/stock-adjustment-in.repository.ts`
- Create: `server/services/stock-adjustment-in.service.ts`
- Create: `server/services/cancellation.service.ts`
- Create: `server/api/stock-adjustment-ins/index.get.ts`
- Create: `server/api/stock-adjustment-ins/index.post.ts`
- Create: `server/api/stock-adjustment-ins/[id].get.ts`
- Create: `server/api/stock-adjustment-ins/[id].put.ts`
- Create: `server/api/stock-adjustment-ins/[id]/complete.post.ts`
- Create: `server/api/stock-adjustment-ins/[id]/cancel.post.ts`
- Test: `tests/unit/stock-adjustment-in-schema.test.ts`
- Test: `tests/integration/stock-adjustment-in.test.ts`
- Test: `tests/nuxt/stock-adjustment-in-api.test.ts`

**Interfaces:**

- Produces: draft CRUD, `completeStockAdjustmentIn(id, actorId)`, and `cancelStockAdjustmentIn(id, actorId)`.
- Consumes: Task 4 master validation, Task 6 numbering/locks/balance/transaction wrapper.

- [ ] **Step 1: Write failing business tests**

Cover positive quantity, zero/negative rejection, inactive Customer/Device Detail/Rack rejection, draft no effect, completion +10, repeated completion remaining +10, completed content immutability, reversal -10, repeated cancellation, and cancellation blocked when current stock is below 10.

The central assertion is:

```ts
await completeStockAdjustmentIn(draft.id, admin.id)
await completeStockAdjustmentIn(draft.id, admin.id)
expect(await getStockBalance(prisma, detail.id, rack.id)).toBe(10)
expect(await prisma.stockMovement.count({ where: { transactionId: draft.id } })).toBe(1)
```

- [ ] **Step 2: Verify red**

Run: `pnpm test:unit tests/unit/stock-adjustment-in-schema.test.ts && pnpm test:integration tests/integration/stock-adjustment-in.test.ts`

Expected: FAIL because adjustment services are absent.

- [ ] **Step 3: Implement draft and posting services**

Creation allocates the number in the same transaction as header/details. Completion loads the draft, validates at least one line, aggregates duplicate stock keys, locks keys, reloads active masters, creates one `POSTING` Quantity In movement per detail, and conditionally updates `DRAFT` to `COMPLETED`. Use `createMany` only after every validation passes.

- [ ] **Step 4: Implement completed cancellation**

Lock stock keys, calculate current balances, ensure each aggregated reversal is available, create linked `REVERSAL` Quantity Out rows, and conditionally update status. Draft cancellation has no movement. Only Admin route calls cancellation.

- [ ] **Step 5: Verify backend and routes**

Run: `pnpm test:unit tests/unit/stock-adjustment-in-schema.test.ts && pnpm test:integration tests/integration/stock-adjustment-in.test.ts && pnpm test:nuxt tests/nuxt/stock-adjustment-in-api.test.ts`

Expected: all adjustment lifecycle and authorization cases pass.

- [ ] **Step 6: Commit**

```bash
git add shared/schemas/stock-adjustment-in.ts shared/types/transactions.ts server/repositories/stock-adjustment-in.repository.ts server/services/stock-adjustment-in.service.ts server/services/cancellation.service.ts server/api/stock-adjustment-ins tests/unit/stock-adjustment-in-schema.test.ts tests/integration/stock-adjustment-in.test.ts tests/nuxt/stock-adjustment-in-api.test.ts
git commit -m "feat: add stock adjustment posting"
```

---

### Task 8: Implement Stock Release backend and oversell protection

**Files:**

- Create: `shared/schemas/stock-release.ts`
- Create: `server/repositories/stock-release.repository.ts`
- Create: `server/services/stock-release.service.ts`
- Create: `server/api/stock-releases/index.get.ts`
- Create: `server/api/stock-releases/index.post.ts`
- Create: `server/api/stock-releases/[id].get.ts`
- Create: `server/api/stock-releases/[id].put.ts`
- Create: `server/api/stock-releases/[id]/complete.post.ts`
- Create: `server/api/stock-releases/[id]/cancel.post.ts`
- Create: `server/api/stock-releases/[id]/returnable.get.ts`
- Test: `tests/unit/stock-release-schema.test.ts`
- Test: `tests/integration/stock-release.test.ts`
- Test: `tests/integration/concurrent-release.test.ts`
- Test: `tests/nuxt/stock-release-api.test.ts`

**Interfaces:**

- Produces: draft CRUD, `completeStockRelease`, `cancelStockRelease`, availability and eligible-return read models.
- Consumes: ledger balance/locks, adjustment stock, cancellation service.

- [ ] **Step 1: Write failing release tests**

Cover required Engineer and Customer, Service Tag Model/Customer mismatch, inactive data, quantity above displayed/current stock, successful -3, duplicate-key aggregation, revalidation after draft creation, repeated completion, and cancellation +3.

Add a concurrent test:

```ts
const results = await Promise.allSettled([
  completeStockRelease(first.id, user.id),
  completeStockRelease(second.id, user.id),
])
expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
expect(await getStockBalance(prisma, detail.id, rack.id)).toBe(0)
```

- [ ] **Step 2: Verify red**

Run: `pnpm test:unit tests/unit/stock-release-schema.test.ts && pnpm test:integration tests/integration/stock-release.test.ts tests/integration/concurrent-release.test.ts`

Expected: FAIL because release service is absent.

- [ ] **Step 3: Implement release validation and posting**

Trim Engineer Name; validate Customer; require both Model and Customer consistency if Service Tag is set. Lock sorted stock keys, aggregate requested quantities, recalculate each balance, throw `INSUFFICIENT_STOCK` with current availability when needed, create Quantity Out postings, and update status atomically.

- [ ] **Step 4: Implement release cancellation**

Reject cancellation if any associated Return header remains `COMPLETED`. Otherwise create linked Quantity In reversal movements into original source racks and set `CANCELLED` atomically.

- [ ] **Step 5: Verify all release behavior**

Run: `pnpm test:unit tests/unit/stock-release-schema.test.ts && pnpm test:integration tests/integration/stock-release.test.ts tests/integration/concurrent-release.test.ts && pnpm test:nuxt tests/nuxt/stock-release-api.test.ts`

Expected: all tests pass; the concurrent run records one release and one 409-equivalent rejection.

- [ ] **Step 6: Commit**

```bash
git add shared/schemas/stock-release.ts server/repositories/stock-release.repository.ts server/services/stock-release.service.ts server/services/cancellation.service.ts server/api/stock-releases tests/unit/stock-release-schema.test.ts tests/integration/stock-release.test.ts tests/integration/concurrent-release.test.ts tests/nuxt/stock-release-api.test.ts
git commit -m "feat: add concurrency-safe stock releases"
```

---

### Task 9: Implement Stock Return backend, partial returns, and reversal

**Files:**

- Create: `shared/schemas/stock-return.ts`
- Create: `server/repositories/stock-return.repository.ts`
- Create: `server/services/stock-return.service.ts`
- Create: `server/api/stock-returns/index.get.ts`
- Create: `server/api/stock-returns/index.post.ts`
- Create: `server/api/stock-returns/[id].get.ts`
- Create: `server/api/stock-returns/[id].put.ts`
- Create: `server/api/stock-returns/[id]/complete.post.ts`
- Create: `server/api/stock-returns/[id]/cancel.post.ts`
- Create: `server/api/stock-returns/eligible-releases.get.ts`
- Test: `tests/unit/stock-return-schema.test.ts`
- Test: `tests/integration/stock-return.test.ts`
- Test: `tests/integration/concurrent-return.test.ts`
- Test: `tests/nuxt/stock-return-api.test.ts`

**Interfaces:**

- Produces: `getReturnableQuantities`, draft CRUD, `completeStockReturn`, `cancelStockReturn`, and eligible releases endpoint.
- Consumes: completed Release Details, stock locks, transaction wrapper, cancellation service.

- [ ] **Step 1: Write failing return tests**

Cover original release required/completed, detail belonging to selected release, positive quantity, inactive destination rack, +1 valid return, partial return, remaining 2, excessive/full return rejection, different destination rack, repeated completion, and return cancellation -1.

Concurrent test:

```ts
const results = await Promise.allSettled([
  completeStockReturn(returnOfTwo.id, user.id),
  completeStockReturn(anotherReturnOfTwo.id, user.id),
])
expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
expect(await getCompletedReturnedQuantity(releaseDetail.id)).toBe(2)
```

- [ ] **Step 2: Verify red**

Run: `pnpm test:unit tests/unit/stock-return-schema.test.ts && pnpm test:integration tests/integration/stock-return.test.ts tests/integration/concurrent-return.test.ts`

Expected: FAIL because return service is absent.

- [ ] **Step 3: Implement row locking and return calculation**

Within `runInventoryTransaction`, lock referenced release-detail rows using ordered `SELECT ... FOR UPDATE`, verify the header is `COMPLETED`, sum return quantities whose Return header is `COMPLETED`, aggregate duplicate references in the new draft, and reject any total above released quantity. Then create Quantity In movements in each destination rack and complete atomically.

- [ ] **Step 4: Implement return cancellation**

Lock destination stock keys, verify current stock covers every aggregated Quantity Out reversal, add linked reversals, and set the Return header to `CANCELLED`. Its quantities then stop contributing to completed-return sums.

- [ ] **Step 5: Verify all return behavior**

Run: `pnpm test:unit tests/unit/stock-return-schema.test.ts && pnpm test:integration tests/integration/stock-return.test.ts tests/integration/concurrent-return.test.ts && pnpm test:nuxt tests/nuxt/stock-return-api.test.ts`

Expected: partial, excessive, full, concurrent, cross-rack, and cancellation cases pass.

- [ ] **Step 6: Commit**

```bash
git add shared/schemas/stock-return.ts server/repositories/stock-return.repository.ts server/services/stock-return.service.ts server/services/cancellation.service.ts server/api/stock-returns tests/unit/stock-return-schema.test.ts tests/integration/stock-return.test.ts tests/integration/concurrent-return.test.ts tests/nuxt/stock-return-api.test.ts
git commit -m "feat: add partial stock returns"
```

---

### Task 10: Implement ledger-backed report queries and JSON APIs

**Files:**

- Create: `shared/schemas/reports.ts`
- Create: `shared/types/reports.ts`
- Create: `server/repositories/report.repository.ts`
- Create: `server/services/report.service.ts`
- Create: `server/api/reports/stock-card.get.ts`
- Create: `server/api/reports/stock-card-by-customer.get.ts`
- Create: `server/api/reports/stock-in.get.ts`
- Create: `server/api/reports/stock-in-by-customer.get.ts`
- Create: `server/api/reports/stock-out.get.ts`
- Create: `server/api/reports/stock-out-by-customer.get.ts`
- Test: `tests/integration/reports.test.ts`
- Test: `tests/nuxt/report-api.test.ts`

**Interfaces:**

- Produces: six validated report functions returning `ReportResult<T>`, with shared row ordering and filter metadata.
- Consumes: immutable ledger and transaction/master joins.

- [ ] **Step 1: Write a failing sample-scenario report test**

```ts
expect(stockCard.rows.map((row) => [row.quantityIn, row.quantityOut, row.runningBalance])).toEqual([
  [10, 0, 10],
  [0, 3, 7],
  [1, 0, 8],
])
expect(stockIn.rows.map((row) => row.stockInType)).toEqual(['Adjustment In', 'Return'])
expect(stockOut.rows).toHaveLength(1)
expect(customerCard.rows.every((row) => row.customerId === customer.id.toString())).toBe(true)
```

Also test draft exclusion, cancellation reversal visibility in Stock Card, cancelled transaction exclusion in Stock-In/Out, start-date opening balance, all BRD/FSD filters, and deterministic tie ordering.

- [ ] **Step 2: Verify red**

Run: `pnpm test:integration tests/integration/reports.test.ts`

Expected: FAIL because report services are absent.

- [ ] **Step 3: Implement report schemas and SQL queries**

Use parameterized Prisma `$queryRaw` fragments only; never interpolate filter strings. Stock Card reads all ledger movement purposes and calculates running balance with `SUM(quantity_in - quantity_out) OVER (...)`. Stock-In and Stock-Out filter to `POSTING` movements joined to currently `COMPLETED` source headers. Customer endpoints require `customerId`.

- [ ] **Step 4: Add authenticated JSON routes and verify**

Run: `pnpm test:integration tests/integration/reports.test.ts && pnpm test:nuxt tests/nuxt/report-api.test.ts`

Expected: six query and API suites pass with correct columns, filters, and ordering.

- [ ] **Step 5: Commit**

```bash
git add shared/schemas/reports.ts shared/types/reports.ts server/repositories/report.repository.ts server/services/report.service.ts server/api/reports tests/integration/reports.test.ts tests/nuxt/report-api.test.ts
git commit -m "feat: add ledger-backed inventory reports"
```

---

### Task 11: Add Excel exports that exactly match report output

**Files:**

- Create: `server/services/excel.service.ts`
- Create: `server/api/reports/stock-card/export.get.ts`
- Create: `server/api/reports/stock-card-by-customer/export.get.ts`
- Create: `server/api/reports/stock-in/export.get.ts`
- Create: `server/api/reports/stock-in-by-customer/export.get.ts`
- Create: `server/api/reports/stock-out/export.get.ts`
- Create: `server/api/reports/stock-out-by-customer/export.get.ts`
- Test: `tests/integration/report-export.test.ts`
- Test: `tests/nuxt/report-export-api.test.ts`

**Interfaces:**

- Produces: `buildReportWorkbook(definition, result)` and downloadable `.xlsx` responses.
- Consumes: the exact report filters and normalized results from Task 10.

- [ ] **Step 1: Write a failing workbook parity test**

```ts
const result = await getStockCardReport(filters)
const buffer = await buildStockCardWorkbook(filters)
const workbook = new ExcelJS.Workbook()
await workbook.xlsx.load(buffer)
const sheetRows = readDataRows(workbook.getWorksheet('Stock Card')!)
expect(sheetRows).toEqual(result.rows.map(toDisplayedStockCardColumns))
```

Repeat parity checks for Customer, Stock-In, and Stock-Out filters, including cancelled and date-filtered data.

- [ ] **Step 2: Verify red**

Run: `pnpm test:integration tests/integration/report-export.test.ts`

Expected: FAIL because Excel service is absent.

- [ ] **Step 3: Implement one generic workbook builder and thin export routes**

The builder accepts explicit column keys, labels, widths, and value formatters. Add title, applied filters, headings, typed dates, integer quantities, frozen heading rows, auto-filter, and the normalized report rows. Routes set the Excel MIME type and a sanitized timestamped filename.

- [ ] **Step 4: Verify export parity and HTTP headers**

Run: `pnpm test:integration tests/integration/report-export.test.ts && pnpm test:nuxt tests/nuxt/report-export-api.test.ts`

Expected: workbook rows exactly equal displayed columns/order and route headers identify `.xlsx` attachments.

- [ ] **Step 5: Commit**

```bash
git add server/services/excel.service.ts server/api/reports tests/integration/report-export.test.ts tests/nuxt/report-export-api.test.ts
git commit -m "feat: add Excel report exports"
```

---

### Task 12: Build transaction lists, detail pages, and draft form components

**Files:**

- Create: `app/components/transactions/TransactionList.vue`
- Create: `app/components/transactions/TransactionActions.vue`
- Create: `app/components/transactions/TransactionStatusBadge.vue`
- Create: `app/components/transactions/DetailRowsEditor.vue`
- Create: `app/components/transactions/AdjustmentInForm.vue`
- Create: `app/components/transactions/StockReleaseForm.vue`
- Create: `app/components/transactions/StockReturnForm.vue`
- Create: `app/components/transactions/TransactionReviewModal.vue`
- Create: `app/composables/useTransactionResource.ts`
- Create: `app/composables/useStockAvailability.ts`
- Create: `app/pages/transactions/stock-adjustment-ins/index.vue`
- Create: `app/pages/transactions/stock-adjustment-ins/new.vue`
- Create: `app/pages/transactions/stock-adjustment-ins/[id].vue`
- Create: `app/pages/transactions/stock-releases/index.vue`
- Create: `app/pages/transactions/stock-releases/new.vue`
- Create: `app/pages/transactions/stock-releases/[id].vue`
- Create: `app/pages/transactions/stock-returns/index.vue`
- Create: `app/pages/transactions/stock-returns/new.vue`
- Create: `app/pages/transactions/stock-returns/[id].vue`
- Test: `tests/nuxt/transaction-pages.test.ts`

**Interfaces:**

- Produces: all transaction user flows and reusable confirmation/error behavior.
- Consumes: transaction APIs from Tasks 7–9 and auth session from Task 3.

- [ ] **Step 1: Write failing page behavior tests**

Test that Draft shows editable rows, Completed hides edit controls, User cannot see cancellation, release fetches availability after both IDs exist, return shows released/returned/remaining values, completion asks for confirmation, and server field errors render beside inputs.

- [ ] **Step 2: Verify red**

Run: `pnpm test:nuxt tests/nuxt/transaction-pages.test.ts`

Expected: FAIL because pages/components are absent.

- [ ] **Step 3: Build list and shared actions**

Lists use search, date, status, and pagination query state. `TransactionActions` emits `edit`, `complete`, and `cancel`; it derives visibility from status and session role. Completion and cancellation use `UModal`, disable while pending, refresh the record and relevant lists after success, and display 409 messages without losing draft input.

- [ ] **Step 4: Build all three forms**

Forms use shared Zod schemas and `UForm`. Device selection clears incompatible Device Detail. Release Device Detail/Rack changes refresh availability. Return selection loads only completed releases with remaining quantities and never permits direct Engineer/Customer edits. Detail rows use stable local keys but send only allowed API fields.

- [ ] **Step 5: Verify UI and static quality**

Run: `pnpm test:nuxt tests/nuxt/transaction-pages.test.ts && pnpm typecheck && pnpm lint && pnpm format:check`

Expected: page tests and all static checks pass.

- [ ] **Step 6: Commit**

```bash
git add app/components/transactions app/composables/useTransactionResource.ts app/composables/useStockAvailability.ts app/pages/transactions tests/nuxt/transaction-pages.test.ts
git commit -m "feat: add inventory transaction pages"
```

---

### Task 13: Build all report pages and shared filters/table/export UI

**Files:**

- Create: `app/components/reports/ReportFilters.vue`
- Create: `app/components/reports/ReportTable.vue`
- Create: `app/components/reports/ReportExportButton.vue`
- Create: `app/composables/useInventoryReport.ts`
- Create: `app/pages/reports/stock-card.vue`
- Create: `app/pages/reports/stock-card-by-customer.vue`
- Create: `app/pages/reports/stock-in.vue`
- Create: `app/pages/reports/stock-in-by-customer.vue`
- Create: `app/pages/reports/stock-out.vue`
- Create: `app/pages/reports/stock-out-by-customer.vue`
- Test: `tests/nuxt/report-pages.test.ts`

**Interfaces:**

- Produces: six report screens with exact BRD/FSD fields, filters, order, and export query parity.
- Consumes: Task 10 JSON APIs and Task 11 export APIs.

- [ ] **Step 1: Write failing report-page tests**

Assert exact column labels, required Customer on Customer variants, filter serialization, loading/empty/error states, and export URL equality with the active JSON query.

- [ ] **Step 2: Verify red**

Run: `pnpm test:nuxt tests/nuxt/report-pages.test.ts`

Expected: FAIL because report UI is absent.

- [ ] **Step 3: Implement shared report state and six page definitions**

Each page supplies an explicit column array and supported filter array. `useInventoryReport` owns a reactive validated filter object, runs `useAsyncData` with a stable key, resets page on filter change, and builds the export query from the same object. Customer pages do not query until Customer is selected.

- [ ] **Step 4: Verify report UI and static checks**

Run: `pnpm test:nuxt tests/nuxt/report-pages.test.ts && pnpm typecheck && pnpm lint && pnpm format:check`

Expected: all report page and static checks pass.

- [ ] **Step 5: Commit**

```bash
git add app/components/reports app/composables/useInventoryReport.ts app/pages/reports tests/nuxt/report-pages.test.ts
git commit -m "feat: add inventory report pages"
```

---

### Task 14: Add critical Playwright transaction and access-control flows

**Files:**

- Create: `tests/e2e/fixtures.ts`
- Create: `tests/e2e/inventory-flow.spec.ts`
- Create: `tests/e2e/access-control.spec.ts`
- Create: `tests/e2e/report-export.spec.ts`
- Modify: `playwright.config.ts`

**Interfaces:**

- Produces: browser proof of the approved 10 → 7 → 8 flow, role restrictions, and report downloads.
- Consumes: full running Nuxt server and migrated test database.

- [ ] **Step 1: Write the failing sample-flow test**

The test logs in as Admin, creates Customer, Rack A, Device Hard Disk, and the `0B24496` detail; completes +10; logs a -3 release; completes a +1 partial return; asserts stock 8 and remaining 2; then verifies Stock Card, Stock-In, Stock-Out, and Customer reports.

- [ ] **Step 2: Verify red**

Run: `pnpm test:e2e tests/e2e/inventory-flow.spec.ts`

Expected: the first incomplete selector or behavior fails and identifies the missing UI integration.

- [ ] **Step 3: Complete accessibility labels and stable locators**

Use role, label, and visible-text locators. Add explicit accessible labels to production components where the failing test shows a gap; do not add test-only production branches.

- [ ] **Step 4: Add role and export flows**

Verify User cannot access master mutation or cancellation controls, direct forbidden API calls return 403, Admin can cancel an eligible transaction, and downloaded Excel files contain current filtered data.

- [ ] **Step 5: Run all Playwright tests**

Run: `pnpm test:e2e`

Expected: all Chromium transaction, access, and export flows pass.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e playwright.config.ts app
git commit -m "test: add critical inventory browser flows"
```

---

### Task 15: Add production Docker image and operating documentation

**Files:**

- Create: `Dockerfile`
- Create: `.dockerignore`
- Modify: `docker-compose.yml`
- Modify: `README.md`
- Create: `docs/architecture.md`
- Create: `docs/operations.md`
- Create: `server/api/health.get.ts`
- Test: `tests/unit/documentation.test.ts`

**Interfaces:**

- Produces: reproducible Node 22 image, documented local setup, migration/seed/deployment/runbook, and health endpoint.
- Consumes: built Nuxt Node output and database migration commands.

- [ ] **Step 1: Write a failing documentation contract test**

```ts
it('documents every required setup and verification command', () => {
  const readme = readFileSync('README.md', 'utf8')
  for (const command of ['docker compose up -d db', 'pnpm db:deploy', 'pnpm db:seed', 'pnpm test', 'pnpm lint', 'pnpm typecheck', 'pnpm build']) {
    expect(readme).toContain(command)
  }
})
```

- [ ] **Step 2: Verify red**

Run: `pnpm test:unit tests/unit/documentation.test.ts`

Expected: FAIL because setup/deployment documentation is incomplete.

- [ ] **Step 3: Add Docker and health behavior**

Use a Node 22 Debian slim multi-stage image with Corepack/pnpm, locked install, Prisma generate, Nuxt build, non-root runtime user, port 3000, and command `node .output/server/index.mjs`. Add `/api/health` that checks application liveness and database readiness without exposing credentials.

- [ ] **Step 4: Document operation and architecture**

README covers prerequisites, Node 22 activation, pnpm, environment variables, Compose, migrations, seed, dev server, all checks, report export, and Docker run. Operations covers HTTPS reverse proxy, secure cookies, backup expectations, migration-before-deploy, initial Admin rotation, and troubleshooting transaction conflicts. Architecture records ledger and cancellation invariants.

- [ ] **Step 5: Verify documentation and container build**

Run: `pnpm test:unit tests/unit/documentation.test.ts && docker build -t mini-inventory:local . && docker compose config`

Expected: documentation test passes, image builds, and Compose configuration validates.

- [ ] **Step 6: Commit**

```bash
git add Dockerfile .dockerignore docker-compose.yml README.md docs/architecture.md docs/operations.md tests/unit/documentation.test.ts server/api/health.get.ts
git commit -m "docs: add deployment and operating guide"
```

---

### Task 16: Run full verification and requirement audit

**Files:**

- Modify only files implicated by failing verification.
- Review: `prisma/migrations/20260719000100_initial_schema/migration.sql`
- Review: `docs/superpowers/specs/2026-07-19-mini-inventory-system-design.md`
- Review: all automated test files.

**Interfaces:**

- Produces: fresh evidence for every quality gate and an explicit requirement-to-test audit.
- Consumes: all prior tasks.

- [ ] **Step 1: Reset the test database through migrations**

Run: `docker compose up -d db && pnpm db:generate && pnpm prisma migrate reset --force --skip-seed && pnpm db:seed`

Expected: all migrations apply from zero and the environment-driven Admin seed succeeds.

- [ ] **Step 2: Run the complete automated suite**

Run: `pnpm test && pnpm test:e2e`

Expected: zero failed or skipped critical tests, including concurrency and the sample scenario.

- [ ] **Step 3: Run every static quality gate**

Run: `pnpm lint && pnpm format:check && pnpm typecheck && pnpm build`

Expected: every command exits 0 with no unresolved warning affecting functionality.

- [ ] **Step 4: Verify database constraints and query indexes**

Run: `pnpm prisma validate && pnpm prisma migrate status`

Inspect PostgreSQL constraints/indexes with a read-only catalog query and confirm all ERD foreign keys, nullability, uniqueness, quantity checks, movement checks, source idempotency, balance index, customer index, and return aggregation index exist.

- [ ] **Step 5: Verify the production container**

Run: `docker build -t mini-inventory:verification . && docker compose config`

Expected: image build and Compose validation exit 0. Start the image against PostgreSQL and confirm `/api/health` reports ready.

- [ ] **Step 6: Audit scope and acceptance criteria line by line**

Map every Required Scope item, validation rule, cancellation safeguard, report column/filter, role rule, and minimum test from the user request to a passing test or inspected implementation. Confirm no out-of-scope modules, infrastructure, or independently editable stock field exists.

- [ ] **Step 7: Record the final evidence**

Capture the exact command versions, exit codes, test counts, migration status, sample-scenario balances, container result, assumptions, and any unavailable environmental checks for the final handoff. If verification required code fixes, rerun the affected task's complete red-green verification and its documented commit step before recording evidence. Do not create an empty commit.

## Plan self-review result

- Every approved design section maps to at least one task.
- Authentication, all six masters, all three transaction lifecycles, atomic ledger posting, locking, reversal cancellation, all six reports, Excel parity, UI, migrations, tests, Docker, and documentation have explicit tasks.
- Interface names used by later tasks are introduced by earlier tasks.
- The plan contains no deferred implementation items or unspecified feature work.
