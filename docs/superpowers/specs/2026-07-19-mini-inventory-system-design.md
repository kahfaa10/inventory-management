# Mini Inventory Management System Design

**Date:** 2026-07-19

**Status:** Approved

**Runtime:** Node.js 22 LTS
**Application:** Full-stack Nuxt 4 monolith

## 1. Purpose and scope

This design defines the implementation of the Mini Inventory Management System described by the repository's BRD, FSD, and ERD. The system records parts entering inventory, releases to engineers, returns, rack-level balances, and movement history for internal company use.

The implementation is limited to:

- Model and child Service Tag masters.
- Device and child Device Detail masters.
- Customer and Rack masters.
- Stock Adjustment In, Stock Release, and Stock Return transactions.
- Stock Card, Stock-In, and Stock-Out reports, including Customer variants.
- Cookie-based authentication with Administrator and User access.
- Excel report export and basic audit fields.

The implementation excludes approval workflows, purchase orders, suppliers, reservations, transfers, barcode scanning, notifications, procurement or ERP integration, microservices, GraphQL, Redis, and message queues.

## 2. Source precedence and resolved inconsistency

Requirements are interpreted in this order:

1. BRD for approved business scope.
2. FSD for behavior, validation, flows, and calculations.
3. ERD for relational structure and relationships.
4. Repository conventions where they exist.

The repository contains no existing application architecture or code conventions. Its reference documents are at the repository root, despite the requested `docs/` paths, and are treated as the authoritative documents.

The BRD describes Device Detail uniqueness as Part Number plus DP/N, while the ERD recommends Device, Part Number, and DP/N. The approved resolution is to follow the ERD constraint:

```text
UNIQUE (device_id, part_number, dpn)
```

Because PostgreSQL treats null values as distinct in ordinary unique constraints, the migration will use null-safe uniqueness so that two rows with the same Device and Part Number and a null DP/N are rejected. This will be implemented with PostgreSQL `NULLS NOT DISTINCT` or an equivalent null-safe unique index supported by the selected PostgreSQL version.

## 3. Architecture

The application is one Nuxt 4 repository and one deployable Node server. Nitro server routes provide the backend; no separate service or backend framework is used.

Responsibilities are divided as follows:

- `app/`: pages, layouts, route middleware, Nuxt UI components, and composables.
- `server/api/`: authenticated REST endpoints and HTTP response mapping.
- `server/services/`: business operations, including posting, validation, numbering, cancellation, return calculation, reports, and Excel generation.
- `server/repositories/`: focused reusable Prisma queries where a repository abstraction reduces duplication.
- `server/utils/`: Prisma setup, session and role guards, database locks, API errors, and transaction helpers.
- `shared/`: Zod schemas, enums, DTOs, filter types, and validation messages safe for server and browser use.
- `prisma/`: Prisma schema, migrations, and development seed.
- `tests/`: unit, integration, Nuxt, and Playwright tests.

Browser code never imports or receives Prisma models. API routes map database records into DTOs, and all `BIGINT` identifiers are serialized as strings.

## 4. Technology choices

- Nuxt 4 with TypeScript.
- Nitro server routes.
- Node.js 22 LTS and pnpm.
- Nuxt UI with its Tailwind CSS integration.
- PostgreSQL.
- Prisma ORM and Prisma Migrate.
- The PostgreSQL Prisma driver adapter required by the installed Prisma version.
- `nuxt-auth-utils` encrypted cookie sessions.
- Argon2 password hashing.
- Zod shared validation.
- Nuxt `useFetch`, `useAsyncData`, and composables for server state.
- No Pinia unless a later proven cross-page state requirement emerges; none is part of this design.
- ExcelJS server-side Excel generation.
- Vitest, Nuxt Test Utils, and Playwright.
- Docker Compose for local PostgreSQL.
- A multi-stage Dockerfile using Nuxt Node server output.

## 5. Authentication and authorization

The schema includes a `users` table with a `BIGINT` identity primary key, unique normalized email, display name, Argon2 password hash, `ADMIN` or `USER` role, active status, and audit timestamps.

Authentication behavior:

- Login verifies an active user and Argon2 hash, then creates an encrypted cookie session using `nuxt-auth-utils`.
- Logout clears the session.
- Global application middleware redirects anonymous browser users to login.
- Every protected API route independently requires a valid active-user session.
- Session data contains only the user ID, display name, email, and role.
- Password hashes and internal database details never appear in DTOs.

Access rules:

- `ADMIN`: maintain masters, create and complete transactions, cancel eligible transactions, view reports, and export reports.
- `USER`: create and complete transactions, view stock and reports, and export reports.
- `USER` cannot create or edit master data and cannot cancel transactions.

The seed command creates or updates the initial administrator only when administrator credentials are supplied through environment variables. No production password is hardcoded.

## 6. Database design

### 6.1 Primary keys and audit fields

The repository has no prior ID convention. All tables use PostgreSQL `BIGINT GENERATED BY DEFAULT AS IDENTITY`. API DTOs expose IDs as decimal strings.

Master and transaction records include `created_at` and `updated_at`. Transaction headers and ledger movements include `created_by` as a required foreign key to `users`. Detail tables include timestamps as specified by the ERD.

### 6.2 Master tables

- `models`: unique model name, description, active status, timestamps.
- `service_tags`: required Model, optional Customer, globally unique service tag, description, active status, timestamps.
- `customers`: unique customer name, address, contact fields, description, active status, timestamps.
- `devices`: unique device name, description, active status, timestamps.
- `device_details`: required Device, Part Number, Specification, optional DP/N and description, active status, timestamps, null-safe unique Device/Part Number/DP/N constraint.
- `racks`: unique rack code, required rack name, description, active status, timestamps.

Master names, codes, tags, part numbers, and DP/N values are trimmed before persistence. Uniqueness is case-insensitive through normalized unique indexes so visually equivalent internal records cannot be created with letter-case variations.

Masters are deactivated instead of permanently deleted. This preserves historical transactions and prevents rack deletion when referenced by stock or history.

### 6.3 Transaction tables

The transaction tables follow the ERD:

- `stock_adjustment_ins` and `stock_adjustment_in_details`.
- `stock_releases` and `stock_release_details`.
- `stock_returns` and `stock_return_details`.

Every header has a unique transaction number, business date, status, creator, and audit timestamps. Header-specific fields and foreign keys match the ERD. Each Stock Return Detail references one `stock_release_detail_id`, not only its release header.

Transaction detail quantities use positive integers enforced by database check constraints as well as Zod and service validation. Each transaction must contain at least one detail before completion.

### 6.4 Supporting tables

`transaction_counters` stores transaction type, year-month, and the last allocated integer. A unique constraint on type and year-month allows an atomic upsert to produce formats `SAI-YYYYMM-0001`, `SRL-YYYYMM-0001`, and `SRT-YYYYMM-0001`. Numbers are allocated when the draft is created. Gaps are allowed if a draft is cancelled; numbers are never reused.

### 6.5 Stock movement ledger

`stock_movements` is immutable and is the inventory source of truth. It stores the ERD fields plus:

- A movement purpose distinguishing original posting from cancellation reversal.
- Optional `reversal_of_id` referencing the original movement.
- A unique source identity covering transaction type, transaction detail ID, and movement purpose.

Each row has exactly one positive side: either `quantity_in > 0` and `quantity_out = 0`, or the inverse. A check constraint enforces this invariant.

Current stock is always calculated as:

```text
SUM(quantity_in) - SUM(quantity_out)
```

grouped at minimum by `device_detail_id` and `rack_id`. No independently editable stock quantity or cached balance table is used.

Indexes support balance aggregation, chronological reports, customer filters, transaction lookups, and return calculations. Foreign-key delete actions use restriction for historical entities.

## 7. Transaction state and idempotency

Allowed transitions are:

```text
DRAFT -> COMPLETED
DRAFT -> CANCELLED
COMPLETED -> CANCELLED
```

There is no transition out of `CANCELLED`, and completed or cancelled transaction content is immutable.

Creating a transaction allocates its number and persists a draft. Drafts have no ledger rows. Completion and completed cancellation execute in one database transaction that includes status validation, business validation, stock or return validation, ledger insertion, and status update.

Status predicates and unique movement source identities prevent repeated completion or cancellation requests from creating duplicate movements. An action against a transaction already in the requested terminal state returns its current representation without adding movements. An invalid different transition returns HTTP 409.

## 8. Concurrency and database locking

The ledger remains the only balance source. Concurrent stock operations are coordinated with PostgreSQL transaction-scoped advisory locks.

For every affected Device Detail/Rack pair, the service computes a stable lock key, sorts keys deterministically, acquires each lock, and then recalculates the ledger balance inside the same transaction. Deterministic ordering prevents deadlocks for multi-line transactions.

Stock Release completion rejects any line or aggregated duplicate lines that exceed the freshly recalculated available stock. The transaction cannot commit a negative balance.

Stock Return completion locks every referenced Stock Release Detail row in deterministic order, recalculates all completed, non-cancelled returns, and validates the requested aggregate quantity against the remaining returnable quantity. This prevents concurrent requests from returning more than was released.

Database deadlocks and serialization-like conflicts are mapped to a retriable 409 response. The UI refreshes the displayed stock or returnable amount and asks the user to review the transaction.

## 9. Transaction behavior

### 9.1 Stock Adjustment In

- Required business date, one or more details, active Device Detail, active destination Rack, and positive integer quantity.
- Optional active Customer and notes.
- Completion creates a Quantity In movement for each detail.
- Draft has no stock effect.

### 9.2 Stock Release

- Required release date, nonblank Engineer Name, active Customer, one or more details, active Device Detail, active source Rack, and positive integer released quantity.
- Optional active Model, optional active Service Tag, reference number, and notes.
- When Service Tag is selected, it must belong to the selected Model and Customer. A Service Tag therefore requires both optional header associations to be selected consistently.
- Available quantity is displayed after Device Detail and Rack selection, but completion always recalculates it.
- Completion creates a Quantity Out movement per detail.
- Duplicate details for the same Device Detail/Rack are validated using their summed quantity.

### 9.3 Stock Return

- Required return date and original completed Stock Release.
- Engineer and Customer are displayed from the release rather than copied into editable return fields.
- Each detail references a released detail, positive integer return quantity, and active destination Rack.
- Partial returns and different destination racks are supported.
- Remaining returnable quantity is Released Quantity minus completed, non-cancelled Return Quantity.
- Completion creates a Quantity In movement using the released Device Detail and selected destination Rack.
- Fully returned release details are unavailable for further return selection.

## 10. Cancellation

Cancellation always requires an explicit UI confirmation. Only Administrators may invoke it.

- Cancelling a draft changes its status with no ledger movement.
- Cancelling a completed transaction preserves each original movement and creates one equal, opposite movement linked by `reversal_of_id`.
- The header changes to `CANCELLED` in the same database transaction.
- Repeated cancellation cannot create duplicate reversals.

Safeguards:

- Cancelling Stock Adjustment In first locks affected inventory keys and rejects cancellation if its Quantity Out reversal would make current rack stock negative.
- Cancelling Stock Release restores stock to each original source Rack. It is rejected while any completed Stock Return exists for its details; completed returns must be cancelled first.
- Cancelling Stock Return locks destination inventory keys and rejects cancellation if removing the returned stock would make its destination Rack balance negative. Cancellation restores the release detail's returnable quantity through the status-aware calculation.

## 11. Validation and HTTP errors

Shared Zod schemas validate request bodies and query filters on server and browser. Server services additionally validate database state, active masters, relationships, transitions, stock, and returnable quantities.

API errors use this stable form:

```ts
interface ApiErrorBody {
  statusCode: number
  code: string
  message: string
  fieldErrors?: Record<string, string[]>
}
```

Validation failures use HTTP 400 or 422, unauthenticated requests 401, forbidden role actions 403, missing records 404, and state, uniqueness, or concurrency conflicts 409. Production responses never expose stack traces.

User-facing messages use the FSD wording, including:

- `Quantity must be greater than zero.`
- `Engineer Name is required.`
- `Customer is required.`
- `Released quantity cannot exceed available stock.`
- `Return quantity cannot exceed remaining returnable quantity.`
- `Device Detail is required.`
- `Rack is required.`
- `Original Stock Release is required.`
- `Selected master data is inactive.`
- `Duplicate record already exists.`

## 12. API design

Authenticated REST resources are exposed beneath `/api`:

- `/api/models`
- `/api/service-tags`
- `/api/devices`
- `/api/device-details`
- `/api/customers`
- `/api/racks`
- `/api/stock-adjustment-ins`
- `/api/stock-releases`
- `/api/stock-returns`
- `/api/reports/stock-card`
- `/api/reports/stock-in`
- `/api/reports/stock-out`

Master resources provide list, create, read, and update operations. Transaction resources provide list, create, read, and draft update operations. Dedicated action endpoints perform completion and cancellation. Stock balance and eligible return endpoints expose calculated read models. Report export endpoints accept the same validated filter schema as their corresponding JSON endpoints.

All mutations use explicit Zod-picked properties; arbitrary request keys are ignored or rejected to prevent mass assignment.

## 13. User interface

The application uses Nuxt UI components and a desktop-oriented responsive dashboard layout. Sidebar navigation follows the BRD sections: Master, Transaction, and Report.

Master pages include a searchable paginated list, create form, edit form, active toggle, and field-level validation. No permanent-delete control is presented.

Transaction pages include lists with status filters, draft forms with header and removable detail rows, read-only detail views, review before completion, completion confirmation, and Administrator-only cancellation confirmation.

The Stock Release form filters Device Details by Device, shows racks with stock, and displays a freshly fetched Available Quantity. The Stock Return form shows inherited Engineer and Customer plus Released, Previously Returned, and Remaining Returnable quantities for every eligible release detail.

Report pages provide the exact BRD/FSD filters and columns. Customer variants require a selected Customer. Tables support empty, loading, error, and pagination states. Excel export uses the current filter state.

Nuxt `useFetch`, `useAsyncData`, and focused composables manage server-backed state. Pinia is not included because no unrelated pages require shared mutable client state.

## 14. Reporting

Report services query `stock_movements` as their primary source and join descriptive master or transaction data needed for output.

Stock Card reports include original movements and cancellation reversals so chronological history and net stock remain traceable. Sorting is Transaction Date, movement creation timestamp, Transaction Number, and movement ID for a deterministic final tie-breaker. Running balance is calculated with PostgreSQL window functions partitioned by Device Detail and Rack. When a start date is selected, earlier movements contribute an opening balance even though those earlier rows are not displayed.

Stock Card by Customer applies the same movement logic and includes only movements with the selected Customer. Its running balance is the selected Customer's movement balance, not the physical rack's total balance.

Stock-In reports contain original movements for currently completed Stock Adjustment In and Stock Return headers. Stock-Out reports contain original movements for currently completed Stock Release headers. Cancelled headers and reversal rows are excluded from these transaction-oriented reports, while their net effects remain visible in Stock Card history.

ExcelJS generates `.xlsx` files on the server. A shared normalized report-row function supplies both JSON tables and exports so active filters, displayed columns, and ordering match exactly. Workbooks include a report title, applied filter values, column headings, typed dates, numeric quantities, and all filtered rows.

## 15. Testing strategy

Development follows red-green-refactor test-driven development for business behavior.

- Vitest unit tests cover Zod schemas, validation messages, transaction number formatting, state transitions, reversal construction, and return calculations.
- PostgreSQL integration tests cover master uniqueness, inactive-master rejection, atomic posting, stock aggregation, idempotency, cancellation safeguards, report filtering, running balances, and Excel contents.
- Concurrent integration tests issue simultaneous releases against final stock and simultaneous returns against one release detail to prove overselling and excessive returns cannot occur.
- Nuxt Test Utils covers route authentication, role authorization, request validation, and structured errors.
- Playwright covers login and the critical Adjustment In to Release to Partial Return to Report flow, plus Administrator/User restrictions.

The sample scenario is automated: 10 units adjusted into Rack A, 3 released, 1 returned, final stock 8, remaining returnable 2, Stock Card movements +10/-3/+1, and matching Customer, Stock-In, and Stock-Out reports.

## 16. Local development and deployment

The repository declares Node.js 22 and pnpm requirements. Docker Compose runs PostgreSQL with a persistent named volume and health check. Environment examples document database, session, and administrator seed values.

Prisma Migrate owns schema changes. Local setup runs dependency installation, database startup, migration deployment, and the optional administrator seed.

The production Dockerfile installs with pnpm, generates Prisma artifacts, builds Nuxt's Node server preset, and copies only required server output and production runtime dependencies into the final Node.js 22 image. HTTPS terminates at the company's internal reverse proxy; the Nuxt server honors secure production cookies.

## 17. Implementation phases

1. Project foundation, database environment, Prisma, test harness, and authentication.
2. Master schema, services, APIs, and pages.
3. Transaction numbering, ledger queries, and locking utilities.
4. Stock Adjustment In posting and cancellation.
5. Stock Release availability, posting, concurrency protection, and cancellation.
6. Stock Return eligibility, partial returns, concurrency protection, and cancellation.
7. Stock Card, Stock-In, and Stock-Out query services and APIs.
8. Report pages and Excel export.
9. Transaction UI completion and Playwright flows.
10. Full verification, index and foreign-key review, sample scenario, Docker build, and documentation.

Each phase must pass its relevant tests before the next phase begins. The system is not considered complete until migrations, automated tests, lint, formatting checks, type checks, the production build, and the sample verification scenario all succeed.

## 18. Assumptions

- PostgreSQL is new enough to support the selected null-safe unique-index implementation.
- Transaction quantities are whole positive units, not decimals.
- Transaction dates are stored as PostgreSQL dates; timestamps are stored in UTC and displayed in the configured Asia/Jakarta timezone.
- Search is case-insensitive and partial for human-readable names, codes, numbers, tags, and references.
- Pagination defaults to 20 rows and is capped at 100 rows per API request; Excel exports are not paginated.
- Draft transaction numbers may contain gaps after cancellation, but are never reused.
- Historical master labels are read through retained foreign-key records because masters are deactivated rather than deleted.
