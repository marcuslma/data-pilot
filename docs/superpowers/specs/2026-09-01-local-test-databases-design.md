# Local test databases: Docker Compose and deterministic seeds

## Purpose

Provide a self-contained local environment for exercising Data Pilot's ephemeral
PostgreSQL and MongoDB query API. The environment must start both database
engines, load useful but limited test datasets, and keep data across normal
container restarts.

This is development-only infrastructure. It does not run as part of the NestJS
application or add a database dependency to production.

## Scope

- Add a root `compose.yaml` with PostgreSQL and MongoDB services.
- Use named Docker volumes so data survives `docker compose stop`, `down`, and
  subsequent `up` commands.
- Load deterministic, version-controlled seeds only when a database volume is
  created empty.
- Document local connection URLs and example catalog/query API requests.
- Seed PostgreSQL with first-generation Pokémon data from the Kanto region.
- Seed MongoDB with people and planets limited to the original Star Wars
  trilogy (Episodes IV, V, and VI).

Out of scope:

- Persistent registration of sources in Data Pilot.
- Runtime data fetching from PokéAPI, SWAPI, or any other remote service.
- Authentication or production hardening beyond the local database users
  required by the official images.
- Expanding the datasets to later Pokémon generations or Star Wars films.

## Architecture

`compose.yaml` defines two independently usable services:

| Service | Image family | Database | Host port | Persistent volume |
| --- | --- | --- | --- | --- |
| `postgres` | official PostgreSQL image | `pokemon` | `5433` | `postgres-data` |
| `mongodb` | official MongoDB 7.0.40 image | `starwars` | `27018` | `mongodb-data` |

The services use non-default host ports to coexist with common local PostgreSQL
and MongoDB installations. Health checks distinguish a started container from a
database ready to accept queries. The services mount read-only seed
directories at the official image initialization location,
`/docker-entrypoint-initdb.d`.

The initialization behaviour is intentional: official PostgreSQL and MongoDB
images execute the mounted scripts only when their data directory is empty.
Named volumes consequently preserve developer edits and query experiments.
The explicit reset operation is `docker compose down -v`; it removes both
named volumes, so the next `up` recreates and seeds the data.

The Compose environment uses development-only, non-sensitive credentials. The
README labels them as local values and shows the equivalent connection URLs
for the API. No `.env` file or external secret is added.

## PostgreSQL dataset

The relational model deliberately has enough structure for catalog discovery
and relationship queries without modelling every game mechanic:

```text
regions (1) ---< cities
       \
        \---< pokemon ---< pokemon_types
```

- `regions`: one row for Kanto.
- `cities`: Kanto's named settlements and the Indigo Plateau, with a `kind`
  field so cities, towns, villages, islands, and the plateau are clear rather
  than artificially flattened.
- `pokemon`: all 151 Generation I Pokémon, identified by National Pokédex
  number and linked to Kanto.
- `pokemon_types`: one or two types for every Pokémon, using the original
  Generation I type chart. It permits natural joins and aggregation queries
  without requiring PostgreSQL array operators.

The seed uses schema and data SQL files in sorted initialization order. Keys,
foreign keys, uniqueness constraints, and indexes make relationships visible
to the catalog endpoint and make ordinary exploratory queries efficient.

## MongoDB dataset

The `starwars` database contains only these collections:

- `characters`: a fixed fixture of 44 individual named characters from Episodes
  IV–VI. Every document has a stable `slug`, display `name`, and an `episodes`
  array; `species` and `homeworld` are present only when the fixture records a
  value. `homeworld` stores a `planets.slug` value when that world is part of
  the planetary fixture.
- `planets`: seven on-screen planetary bodies—Alderaan, Bespin, Dagobah,
  Endor, Hoth, Tatooine, and Yavin IV. Every document has a stable `slug`,
  display `name`, `episodes`, `classification`, `terrain`, and `climate`.

The seed intentionally excludes people and worlds introduced solely in the
prequel trilogy, sequel trilogy, television, books, or games. It is a fixed
test fixture rather than an encyclopaedic Star Wars database. It retains
cross-collection references as plain `homeworld` strings instead of MongoDB
`ObjectId` references; that keeps the documents legible in `find` and
aggregation examples while still supporting `$lookup` demonstrations.

The seed is a version-controlled JavaScript initialization script. It creates
indexes on slugs and episode arrays, inserts the fixed documents, and creates
a database user usable through the documented application connection URL.

## Data flow and use

1. A developer runs `docker compose up -d`.
2. Docker creates named volumes if absent and starts both database engines.
3. On an empty volume, each official image executes its mounted seed scripts.
4. The developer starts Data Pilot with `NODE_ENV=development` and passes a
   local connection URL only in the request body or shell environment.
5. The existing `/catalog` and `/query` endpoints inspect or query either
   database through short-lived connections.
6. Stopping or recreating containers without `-v` retains data. Running
   `docker compose down -v` is the documented destructive reset.

## Documentation and developer experience

The README gains a local database section containing:

- prerequisites (Docker Desktop / Docker Engine with Compose);
- start, status, logs, stop, and explicit reset commands;
- PostgreSQL and MongoDB connection URLs for this stack;
- one catalog request and one query example per database, using the seeded
  collections/tables; and
- a reminder that the credentials and exposed ports are for local test use.

## Failure behaviour

- The host ports are `5433` and `27018`, chosen to coexist with the common
  `5432` and `27017` local defaults. If either alternate port is already in
  use, Compose reports the conflict without modifying the conflicting service.
- If an initialization script fails, the service becomes unhealthy and logs
  identify the failed seed. Since images only re-run initialization on empty
  data directories, the recovery path is to correct the seed and run the
  documented explicit reset.
- API connection and query errors continue to be handled by the existing
  runtime data-source adapters; the Compose setup does not weaken their
  development/test environment guard or query restrictions.

## Verification

- Validate the Compose model with `docker compose config`.
- Start the services with `docker compose up -d` and wait for both health
  checks.
- Query PostgreSQL for the expected 151 Pokémon and Kanto city count.
- Query MongoDB for documents confined to Episodes IV–VI and verify both
  collections and their indexes exist.
- Exercise the existing API catalog and read-only query endpoints against both
  seeded connection URLs.
- Run `npm run lint`, `npm test`, `npm run build`, and the relevant end-to-end
  tests.
- Stop the stack without deleting its volumes and verify a subsequent startup
  preserves an inserted test row/document. The automated verification must not
  delete an existing developer volume.

## Files expected to change

- `compose.yaml`
- `docker/postgres/init/00-schema.sql`
- `docker/postgres/init/01-seed.sql`
- `docker/mongodb/init/01-seed.js`
- `README.md`
- Focused automated tests or test fixtures only if required for the new
  documented behaviour.
