# Runtime Test Database Query Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build development/test-only HTTP endpoints that inspect a temporary PostgreSQL or MongoDB source and execute one native read query without persisting credentials or source metadata.

**Architecture:** A `DataSourcesModule` owns controllers, DTOs, an environment guard, a registry, and two adapters. The controller passes a request-scoped source definition to services; the registry dispatches to an adapter that creates and closes its own driver connection. PostgreSQL SQL remains native but is bounded to one statement inside a read-only transaction; MongoDB receives native `find` or `aggregate` input after recursive unsafe-operator validation.

**Tech Stack:** NestJS 12, TypeScript ESM with Node 26, Vitest, Supertest, `class-validator`, `class-transformer`, `pg`, `pg-cursor`, `mongodb`.

**Spec:** `docs/superpowers/specs/2026-09-01-runtime-test-database-query-design.md`

## Global Constraints

- Use Node.js v26 only; preserve `module` and `moduleResolution` as `nodenext`.
- Keep strict TypeScript and ESM `.js` relative imports.
- Do not persist a source, catalog, URL, password, connection, or query history.
- Never include `connectionUrl` or driver error text in HTTP responses or logs.
- Enable these endpoints only when `NODE_ENV` is exactly `development` or `test`.
- Support `postgres` and `mongodb`; a request can access exactly one source.
- PostgreSQL allows one native SQL statement in a `READ ONLY` transaction with a 10-second timeout.
- MongoDB allows only `find` and `aggregate`, and rejects `$out`, `$merge`, `$function`, `$accumulator`, and `$where` at every nesting level.
- Return at most 1,000 rows/documents; serialize MongoDB BSON with Extended JSON.
- Add focused unit tests and e2e tests, then run `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e`.
- Do not create a commit unless the user explicitly asks for one.

---

## Planned file structure

| File | Responsibility |
| --- | --- |
| `src/main.ts` | Enable Nest validation for all incoming DTOs. |
| `src/app.module.ts` | Import `DataSourcesModule`. |
| `src/data-sources/data-source.types.ts` | Shared source, catalog, native-query, and result contracts. |
| `src/data-sources/data-source.adapter.ts` | Adapter interface and injection token. |
| `src/data-sources/data-source.registry.ts` | Resolve a source kind to its adapter. |
| `src/data-sources/data-source.service.ts` | Validate source/query compatibility and call the selected adapter. |
| `src/data-sources/data-sources.controller.ts` | `POST /catalog` and `POST /query`. |
| `src/data-sources/data-sources.module.ts` | Nest providers and driver factories. |
| `src/data-sources/runtime-access.guard.ts` | Permit requests only in development/test. |
| `src/data-sources/dto/*.ts` | HTTP boundary validation DTOs. |
| `src/data-sources/postgres.adapter.ts` | PostgreSQL catalog inspection and cursor-backed SQL execution. |
| `src/data-sources/mongodb.adapter.ts` | MongoDB catalog inspection, native reads, and BSON conversion. |
| `src/data-sources/sql-statement.ts` | Detect more than one SQL statement without mistaking quoted/commented semicolons for separators. |
| `src/data-sources/mongo-query-validation.ts` | Recursively reject MongoDB write/server-JavaScript operators. |
| `src/data-sources/*.spec.ts` | Unit coverage for all focused units. |
| `test/data-sources.e2e-spec.ts` | HTTP boundary and environment-gate coverage. |
| `README.md` | Explain local-only setup and request examples without real credentials. |

### Task 1: Install drivers and enable DTO validation

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/main.ts`
- Test: `test/data-sources.e2e-spec.ts`

**Interfaces:**
- Produces globally active Nest `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, and `transform: true`.
- Produces production dependencies `class-transformer`, `class-validator`, `pg`, `pg-cursor`, and `mongodb`; produces development dependency `@types/pg-cursor`.

- [x] **Step 1: Write the failing e2e DTO-validation test.**

  Create `test/data-sources.e2e-spec.ts` with a `POST /catalog` test whose body includes a valid-looking `source` plus an unexpected `extra` key. It must expect `400` and a validation error that identifies `extra`.

  ```ts
  await request(app.getHttpServer())
    .post('/catalog')
    .send({
      source: {
        kind: 'postgres',
        connectionUrl: 'postgresql://localhost/test',
        extra: 'not accepted',
      },
    })
    .expect(400);
  ```

- [x] **Step 2: Run the focused test to verify it fails.**

  Run: `npm test -- test/data-sources.e2e-spec.ts`

  Expected: FAIL because the endpoint and global validation pipe do not exist.

- [x] **Step 3: Install the smallest required packages.**

  Run:

  ```bash
  npm install class-transformer class-validator pg pg-cursor mongodb
  npm install --save-dev @types/pg-cursor
  ```

  Do not manually edit `package-lock.json`; npm owns its resolution.

- [x] **Step 4: Enable global validation in `src/main.ts`.**

  Add `ValidationPipe` to the `@nestjs/common` import, then add this immediately after `NestFactory.create` and before `app.listen`:

  ```ts
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  ```

- [x] **Step 5: Re-run the focused test.**

  Run: `npm test -- test/data-sources.e2e-spec.ts`

  Expected: it still fails because the controller/module are not created; retain the test for Task 5.

### Task 2: Create core contracts, adapter registry, and development/test gate

**Files:**
- Create: `src/data-sources/data-source.types.ts`
- Create: `src/data-sources/data-source.adapter.ts`
- Create: `src/data-sources/data-source.registry.ts`
- Create: `src/data-sources/runtime-access.guard.ts`
- Create: `src/data-sources/data-source.registry.spec.ts`
- Create: `src/data-sources/runtime-access.guard.spec.ts`

**Interfaces:**
- Consumes: none.
- Produces `DataSourceKind`, `SourceDefinition`, `DataSourceCatalog`, `NativeQuery`, `QueryResult`, `DataSourceAdapter`, `DATA_SOURCE_ADAPTERS`, `DataSourceRegistry`, and `RuntimeAccessGuard`.

- [x] **Step 1: Write failing unit tests for selection and runtime access.**

  In `data-source.registry.spec.ts`, construct two fake `DataSourceAdapter` objects with `kind: 'postgres'` and `kind: 'mongodb'`. Assert `registry.get('postgres')` returns the PostgreSQL fake and `registry.get('unknown' as DataSourceKind)` throws `BadRequestException` with a fixed, secret-free message.

  In `runtime-access.guard.spec.ts`, use fake `ExecutionContext` objects and temporarily set `process.env.NODE_ENV` to `development`, `test`, and `production`. Assert the guard returns true only for the first two and throws `ForbiddenException` for production.

- [x] **Step 2: Run unit tests and verify they fail.**

  Run: `npm test -- src/data-sources/data-source.registry.spec.ts src/data-sources/runtime-access.guard.spec.ts`

  Expected: FAIL because the modules do not exist.

- [x] **Step 3: Define the contracts in small, dependency-free files.**

  `data-source.types.ts` must define these exact shapes:

  ```ts
  export type DataSourceKind = 'postgres' | 'mongodb';

  export interface SourceDefinition {
    kind: DataSourceKind;
    connectionUrl: string;
  }

  export interface CatalogField {
    path: string;
    types: string[];
  }

  export interface DataSourceCatalog {
    kind: DataSourceKind;
    namespaces: Array<{
      name: string;
      entities: Array<{
        name: string;
        fields: CatalogField[];
        indexes: string[];
      }>;
    }>;
  }

  export type NativeQuery =
    | { language: 'sql'; text: string }
    | {
        language: 'mongo';
        operation: 'find' | 'aggregate';
        collection: string;
        filter?: Record<string, unknown>;
        projection?: Record<string, unknown>;
        sort?: Record<string, 1 | -1>;
        limit?: number;
        pipeline?: Record<string, unknown>[];
      };

  export interface QueryResult {
    kind: DataSourceKind;
    rows: unknown[];
    returnedCount: number;
  }
  ```

  `data-source.adapter.ts` must export `DATA_SOURCE_ADAPTERS` as a symbol and
  the interface:

  ```ts
  export interface DataSourceAdapter {
    readonly kind: DataSourceKind;
    inspect(source: SourceDefinition): Promise<DataSourceCatalog>;
    execute(source: SourceDefinition, query: NativeQuery): Promise<QueryResult>;
  }
  ```

- [x] **Step 4: Implement the registry and guard.**

  The registry receives `DataSourceAdapter[]` through `@Inject(DATA_SOURCE_ADAPTERS)`, locates the adapter by `kind`, and throws `new BadRequestException('Unsupported data source kind.')` when none matches. The guard reads only `process.env.NODE_ENV` and throws `new ForbiddenException('Database endpoints are available only in development or test.')` outside `development` and `test`.

- [x] **Step 5: Re-run focused unit tests.**

  Run: `npm test -- src/data-sources/data-source.registry.spec.ts src/data-sources/runtime-access.guard.spec.ts`

  Expected: PASS.

### Task 3: Implement and test PostgreSQL inspection and native read execution

**Files:**
- Create: `src/data-sources/postgres.adapter.ts`
- Create: `src/data-sources/sql-statement.ts`
- Create: `src/data-sources/postgres.adapter.spec.ts`
- Create: `src/data-sources/sql-statement.spec.ts`

**Interfaces:**
- Consumes: `DataSourceAdapter`, `SourceDefinition`, `DataSourceCatalog`, `NativeQuery`, and `QueryResult` from Task 2.
- Produces `PostgresAdapter`, `POSTGRES_CLIENT_FACTORY`, `PostgresClientFactory`, and `hasMultipleSqlStatements(text: string): boolean`.

- [x] **Step 1: Write failing SQL-statement tests.**

  Test that `hasMultipleSqlStatements` returns false for `SELECT ';'`, `SELECT 1; -- trailing ;`, and `SELECT 1 /* ; */`; returns true for `SELECT 1; SELECT 2`; and treats an unterminated quote or comment as invalid by throwing `BadRequestException('Invalid SQL statement.')`.

- [x] **Step 2: Write failing PostgreSQL adapter tests with a fake client.**

  Inject a fake factory that returns an object with `connect`, `query`, `end`, and `release` spies. Verify that `execute` calls `BEGIN READ ONLY`, `SET LOCAL statement_timeout = '10s'`, the supplied single SQL, and `COMMIT`; it calls `end` in `finally`; and it returns only the first 1,000 rows. Verify a multi-statement string fails before `connect`.

  Add an inspection test that fakes metadata query results for a schema, table, columns, and index names and expects the normalized `DataSourceCatalog` shape. Add a driver-failure test that expects `UnprocessableEntityException('Unable to access the PostgreSQL source.')`, never the original driver message.

- [x] **Step 3: Run PostgreSQL tests and verify they fail.**

  Run: `npm test -- src/data-sources/sql-statement.spec.ts src/data-sources/postgres.adapter.spec.ts`

  Expected: FAIL because the utility and adapter do not exist.

- [x] **Step 4: Implement the single-statement scanner.**

  In `sql-statement.ts`, scan characters while tracking single quotes, double quotes, dollar-quoted strings, line comments, and block comments. A semicolon outside those contexts is valid only when the remaining non-comment content is empty; otherwise return true. Reject empty text and unclosed quoted/comment contexts with the fixed `BadRequestException` from Step 1. Do not parse or classify SQL keywords: PostgreSQL read-only transaction enforcement is responsible for rejecting write statements.

- [x] **Step 5: Implement `PostgresAdapter` with short-lived clients.**

  Define the client-factory token so unit tests do not need a real database:

  ```ts
  export const POSTGRES_CLIENT_FACTORY = Symbol('POSTGRES_CLIENT_FACTORY');

  export type PostgresClientFactory = (connectionUrl: string) => Client;
  ```

  The production factory creates `new Client({ connectionString: connectionUrl })`. `inspect` calls `connect`, queries `current_database()`, `information_schema.columns`, `information_schema.table_constraints`/`key_column_usage`, and `pg_indexes`, then builds namespaces grouped by schema. `execute` first verifies `query.language === 'sql'`, calls the scanner before opening the client, begins the read-only transaction, applies the timeout, executes with `pg-cursor`, reads 1,000 rows, closes the cursor, commits, and returns `{ kind: 'postgres', rows, returnedCount: rows.length }`. On a driver error, throw only the fixed `UnprocessableEntityException`; always call `end` in `finally`.

- [x] **Step 6: Re-run PostgreSQL tests.**

  Run: `npm test -- src/data-sources/sql-statement.spec.ts src/data-sources/postgres.adapter.spec.ts`

  Expected: PASS.

### Task 4: Implement and test MongoDB inspection and native read execution

**Files:**
- Create: `src/data-sources/mongodb.adapter.ts`
- Create: `src/data-sources/mongo-query-validation.ts`
- Create: `src/data-sources/mongodb.adapter.spec.ts`
- Create: `src/data-sources/mongo-query-validation.spec.ts`

**Interfaces:**
- Consumes: the contracts from Task 2.
- Produces `MongoDbAdapter`, `MONGODB_CLIENT_FACTORY`, `MongoDbClientFactory`, `assertSafeMongoQuery(value: unknown): void`, and `inferDocumentFields(documents: Record<string, unknown>[]): CatalogField[]`.

- [x] **Step 1: Write failing recursive-validation tests.**

  Test that `assertSafeMongoQuery` accepts ordinary nested filters and pipelines, while it rejects `$out`, `$merge`, `$function`, `$accumulator`, and `$where` when any appears in an object nested inside an array. Each failure must be `BadRequestException('MongoDB query contains an unsupported operator.')`.

- [x] **Step 2: Write failing MongoDB adapter tests with a fake client.**

  Fake `MongoClient`, `Db`, `Collection`, cursor, `listCollections`, `listIndexes`, and aggregate sampling. Assert inspection emits nested paths such as `customer.address.city`, combines observed type names, samples at most 100 documents, and does not return sample values. Assert `find` uses a maximum limit of 1,000; assert aggregate appends a `$limit: 1000` stage after validating the pipeline; assert client `close` runs after success and failure. Assert driver failures are returned as `UnprocessableEntityException('Unable to access the MongoDB source.')`.

- [x] **Step 3: Run MongoDB tests and verify they fail.**

  Run: `npm test -- src/data-sources/mongo-query-validation.spec.ts src/data-sources/mongodb.adapter.spec.ts`

  Expected: FAIL because the validator and adapter do not exist.

- [x] **Step 4: Implement recursive operator validation and field inference.**

  `assertSafeMongoQuery` must recurse over plain objects and arrays, checking every object key against the five blocked operators. `inferDocumentFields` must recurse through objects, record a dot-separated path, and gather type names in a `Set`; it must represent arrays as `array` at the containing field while continuing to inspect object members in the array. It returns deterministically sorted fields with sorted type arrays.

- [x] **Step 5: Implement `MongoDbAdapter`.**

  The factory token has this form:

  ```ts
  export const MONGODB_CLIENT_FACTORY = Symbol('MONGODB_CLIENT_FACTORY');

  export type MongoDbClientFactory = (connectionUrl: string) => MongoClient;
  ```

  `inspect` connects, lists collections, gets each collection's indexes, samples with `$sample: { size: 100 }` and `maxTimeMS: 10_000`, then maps the inferred fields to the shared catalog. `execute` rejects `language !== 'mongo'`; for `find`, apply filter/projection/sort and `Math.min(query.limit ?? 1_000, 1_000)`; for `aggregate`, validate the provided pipeline and append `{ $limit: 1_000 }`. Serialize results with `EJSON.serialize`, return the shared `QueryResult`, close the client in `finally`, and use only the fixed failure message on driver errors.

- [x] **Step 6: Re-run MongoDB tests.**

  Run: `npm test -- src/data-sources/mongo-query-validation.spec.ts src/data-sources/mongodb.adapter.spec.ts`

  Expected: PASS.

### Task 5: Expose controllers, DTOs, services, and module wiring

**Files:**
- Create: `src/data-sources/dto/source.dto.ts`
- Create: `src/data-sources/dto/catalog-request.dto.ts`
- Create: `src/data-sources/dto/query-request.dto.ts`
- Create: `src/data-sources/data-source.service.ts`
- Create: `src/data-sources/data-sources.controller.ts`
- Create: `src/data-sources/data-sources.module.ts`
- Modify: `src/app.module.ts`
- Modify: `test/data-sources.e2e-spec.ts`

**Interfaces:**
- Consumes: registry, guard, adapters, and types from Tasks 2–4.
- Produces `POST /catalog` and `POST /query`, protected by `RuntimeAccessGuard`.

- [x] **Step 1: Extend e2e tests with all public behaviors.**

  Build the test application with `AppModule`, set `NODE_ENV='test'`, and override the registry with a fake adapter. Cover:

  ```ts
  // unsupported source kind is rejected by DTO validation
  await request(app.getHttpServer())
    .post('/catalog')
    .send({ source: { kind: 'redis', connectionUrl: 'redis://localhost' } })
    .expect(400);

  // valid catalog dispatch returns the normalized catalog from the fake adapter
  await request(app.getHttpServer())
    .post('/catalog')
    .send({ source: { kind: 'postgres', connectionUrl: 'postgresql://localhost/test' } })
    .expect(201)
    .expect({ kind: 'postgres', namespaces: [] });

  // production mode blocks both routes before a source is touched
  process.env.NODE_ENV = 'production';
  await request(app.getHttpServer())
    .post('/query')
    .send({
      source: { kind: 'postgres', connectionUrl: 'postgresql://localhost/test' },
      query: { language: 'sql', text: 'SELECT 1' },
    })
    .expect(403);
  ```

  Add cases for protocol/kind mismatch, SQL query sent to MongoDB, Mongo query sent to PostgreSQL, invalid Mongo operation, and an extraneous body key. Restore the original environment after each test.

- [x] **Step 2: Run e2e tests and verify they fail.**

  Run: `npm run test:e2e -- test/data-sources.e2e-spec.ts`

  Expected: FAIL because the module, DTOs, and routes do not exist.

- [x] **Step 3: Implement DTOs and source/query compatibility checks.**

  `SourceDto` requires `kind` in `['postgres', 'mongodb']` and a non-empty `connectionUrl`. `CatalogRequestDto` nests `source`. `QueryRequestDto` nests `source` and requires `query` to be a plain object. In `DataSourceService`, use `new URL(connectionUrl)` and enforce allowed schemes: `postgres:`/`postgresql:` only for `postgres`, `mongodb:`/`mongodb+srv:` only for `mongodb`; otherwise throw `BadRequestException('Connection URL does not match the source kind.')`.

  Parse `query` into the `NativeQuery` union before dispatch. SQL requires exactly `{ language: 'sql', text: non-empty string }`. Mongo requires `{ language: 'mongo', operation: 'find' | 'aggregate', collection: non-empty string }`, with only object/array optional fields described by `NativeQuery`. Malformed input throws `BadRequestException('Invalid native query.')`.

- [x] **Step 4: Implement the controller and module.**

  Put `@UseGuards(RuntimeAccessGuard)` on `DataSourcesController`. Define `@Post('catalog') inspect(@Body() body: CatalogRequestDto)` and `@Post('query') execute(@Body() body: QueryRequestDto)`. Both delegate only to `DataSourceService`.

  `DataSourcesModule` registers adapters, their factories, registry, service, guard, and controller. Bind the adapter array through `DATA_SOURCE_ADAPTERS` with `useFactory: (postgres, mongo) => [postgres, mongo]`. Import the module into `AppModule` without changing observability behavior.

- [x] **Step 5: Run e2e tests.**

  Run: `npm run test:e2e -- test/data-sources.e2e-spec.ts`

  Expected: PASS.

### Task 6: Document local test usage and run the complete verification suite

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-09-01-runtime-test-database-query.md` (check completed tasks)

**Interfaces:**
- Consumes: final HTTP contract from Task 5.
- Produces: accurate local setup and safe, secret-free examples.

- [x] **Step 1: Add a concise “Test database API” section to `README.md`.**

  State that `NODE_ENV=development` or `NODE_ENV=test` is required, connections are not persisted, and only test/read-only accounts should be used. Give `curl` examples with placeholders for `/catalog`, a PostgreSQL `/query`, and a MongoDB `/query`; no actual host, username, password, database, or token may appear.

- [x] **Step 2: Mark completed plan tasks.**

  Change each completed task checkbox in this plan from `- [ ]` to `- [x]`; do not mark a step until its command has passed.

- [x] **Step 3: Run all required checks.**

  Run:

  ```bash
  npm run lint
  npm test
  npm run build
  npm run test:e2e
  ```

  Expected: all commands exit 0. If any fails, diagnose and correct the failing behavior before continuing.

- [x] **Step 4: Inspect the final diff.**

  Run:

  ```bash
  git diff --check
  git status --short
  git diff -- package.json package-lock.json src test README.md
  ```

  Confirm the change set contains only the source-access feature, tests, and its approved documentation. Do not create a commit unless the user explicitly asks.

## Plan self-review

- **Spec coverage:** Tasks 2–5 cover transient PostgreSQL/MongoDB sources, catalog discovery, native single-source reads, environment gating, blocked MongoDB write/server-JavaScript operators, read-only PostgreSQL transactions, timeouts, BSON conversion, error redaction, and response limits. Task 6 covers usage documentation and all project verification commands.
- **Placeholder scan:** no pending-work markers, unspecified error handling, or unnamed interfaces remain.
- **Type consistency:** Tasks 3–5 use the exact `DataSourceAdapter`, `SourceDefinition`, `NativeQuery`, `DataSourceCatalog`, and `QueryResult` definitions created in Task 2.
