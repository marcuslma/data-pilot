# Local test databases implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide persistent Docker Compose PostgreSQL and MongoDB test databases, seeded with the approved Pokémon/Kanto and original-trilogy Star Wars fixtures.

**Architecture:** A root Compose file runs official database images with named volumes and read-only initialization-script bind mounts. PostgreSQL uses SQL schema/data scripts for the relational Pokémon fixture; MongoDB uses one JavaScript initialization script for its document fixture and restricted local user. The existing NestJS runtime data-source API stays unchanged and is exercised against both databases through documented connection URLs.

**Tech Stack:** Docker Compose v5, PostgreSQL 17, MongoDB 7.0.40, SQL, mongosh JavaScript, NestJS v12, TypeScript/ESM, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-01-local-test-databases-design.md`

## Global Constraints

- Use Node.js v26 only; preserve ESM `nodenext` TypeScript configuration and strict checking.
- This stack is local-development-only; do not add application-time database connections or production configuration.
- Use only fixed, version-controlled seed data; do not fetch data during container startup.
- `postgres-data` and `mongodb-data` must be named volumes and must persist across normal `docker compose down` / `up` cycles.
- Initialization scripts must be mounted read-only at `/docker-entrypoint-initdb.d` and execute only for an empty volume.
- PostgreSQL contains exactly one Kanto region, eleven named Kanto settlements/locations, 151 Generation I Pokémon, and their 213 original-Generation-I type rows.
- MongoDB contains only `characters` and `planets`; the fixture has 44 named original-trilogy characters and seven approved on-screen planetary bodies.
- Do not create a Git commit or push changes unless the user asks explicitly.
- Before completion, run `docker compose config`, integration checks against both databases, `npm run lint`, `npm test`, and `npm run build`.

---

## File structure

| File | Responsibility |
| --- | --- |
| `compose.yaml` | Defines local database services, ports, volumes, health checks, and init mounts. |
| `docker/postgres/init/00-schema.sql` | Creates the PostgreSQL relational tables, keys, constraints, and indexes. |
| `docker/postgres/init/01-seed.sql` | Inserts Kanto, 11 locations, all 151 Generation I Pokémon, and type assignments. |
| `docker/mongodb/init/01-seed.js` | Creates the restricted local MongoDB user, collections, indexes, and 44/7 Star Wars fixture documents. |
| `README.md` | Explains lifecycle commands, URLs, preservation/reset semantics, and API examples. |

### Task 1: Compose service contract

**Files:**
- Create: `compose.yaml`

**Interfaces:**
- Produces service names `postgres` and `mongodb`, reachable at `localhost:5433` and `localhost:27018`.
- Produces named volumes `postgres-data` and `mongodb-data`.
- Consumes the initialization paths created by Tasks 2 and 3.

- [ ] **Step 1: Establish the expected failing validation**

Run: `docker compose config --quiet`

Expected: a non-zero exit because `compose.yaml` does not exist yet.

- [ ] **Step 2: Add the Compose model**

Create `compose.yaml` with this service contract:

```yaml
name: data-pilot

services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: pokemon
      POSTGRES_USER: data_pilot
      POSTGRES_PASSWORD: data_pilot
    ports:
      - '5433:5432'
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./docker/postgres/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U data_pilot -d pokemon']
      interval: 5s
      timeout: 3s
      retries: 10

  mongodb:
    image: mongo:7.0.40
    environment:
      MONGO_INITDB_ROOT_USERNAME: root
      MONGO_INITDB_ROOT_PASSWORD: root
      MONGO_INITDB_DATABASE: starwars
    ports:
      - '27018:27017'
    volumes:
      - mongodb-data:/data/db
      - ./docker/mongodb/init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test:
        [
          'CMD-SHELL',
          'mongosh --quiet --username root --password root --authenticationDatabase admin --eval "db.adminCommand({ ping: 1 }).ok"',
        ]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  postgres-data:
  mongodb-data:
```

- [ ] **Step 3: Validate the Compose model**

Run: `docker compose config --quiet`

Expected: exit code 0 and no model-validation errors.

- [ ] **Step 4: Record the validation output**

Run: `docker compose config --services && docker compose config --volumes`

Expected output includes `postgres`, `mongodb`, `postgres-data`, and
`mongodb-data`.

### Task 2: PostgreSQL Kanto and Generation I fixture

**Files:**
- Create: `docker/postgres/init/00-schema.sql`
- Create: `docker/postgres/init/01-seed.sql`

**Interfaces:**
- Consumes database `pokemon` and role `data_pilot` created by the PostgreSQL image.
- Produces tables `regions`, `cities`, `pokemon`, and `pokemon_types` in the `public` schema.
- Produces queryable columns `regions.id/name`, `cities.region_id/name/kind`, `pokemon.pokedex_number/name/region_id`, and `pokemon_types.pokemon_id/slot/type_name`.

- [ ] **Step 1: Create the schema SQL**

Create `00-schema.sql` with tables and constraints equivalent to:

```sql
CREATE TABLE regions (
  id SMALLINT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  generation SMALLINT NOT NULL CHECK (generation = 1)
);

CREATE TABLE cities (
  id SMALLINT PRIMARY KEY,
  region_id SMALLINT NOT NULL REFERENCES regions(id),
  name TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('town', 'city', 'island', 'plateau'))
);

CREATE TABLE pokemon (
  pokedex_number SMALLINT PRIMARY KEY CHECK (pokedex_number BETWEEN 1 AND 151),
  name TEXT NOT NULL UNIQUE,
  region_id SMALLINT NOT NULL REFERENCES regions(id)
);

CREATE TABLE pokemon_types (
  pokemon_id SMALLINT NOT NULL REFERENCES pokemon(pokedex_number) ON DELETE CASCADE,
  slot SMALLINT NOT NULL CHECK (slot IN (1, 2)),
  type_name TEXT NOT NULL,
  PRIMARY KEY (pokemon_id, slot),
  UNIQUE (pokemon_id, type_name)
);

CREATE INDEX cities_region_id_idx ON cities(region_id);
CREATE INDEX pokemon_region_id_idx ON pokemon(region_id);
CREATE INDEX pokemon_types_type_name_idx ON pokemon_types(type_name);
```

- [ ] **Step 2: Create the fixed seed SQL**

Create `01-seed.sql` in this order:

1. Insert `(1, 'Kanto', 1)` into `regions`.
2. Insert the eleven locations: Pallet Town, Viridian City, Pewter City,
   Cerulean City, Vermilion City, Lavender Town, Celadon City, Fuchsia City,
   Saffron City, Cinnabar Island, and Indigo Plateau, all linked to region 1.
3. Insert every National Pokédex entry 1 through 151, from Bulbasaur through
   Mew, linked to region 1.
4. Insert each canonical Generation I primary type and optional secondary
   type into `pokemon_types`, with slots 1 and 2 respectively.

Use multi-row `INSERT` statements and end the file with assertions that fail
initialization unless the table counts are 1 region, 11 locations, 151 Pokémon,
and 213 type rows. The type rows must use the original Generation I type chart:
Clefairy and Clefable are Normal; Jigglypuff and Wigglytuff are Normal;
Magnemite and Magneton are Electric; and Mr. Mime is Psychic.

- [ ] **Step 3: Start and validate PostgreSQL**

Run: `docker compose up -d postgres && docker compose ps postgres`

Expected: `postgres` becomes healthy.

Run:

```bash
docker compose exec -T postgres \
  psql -U data_pilot -d pokemon -c \
  "SELECT COUNT(*) AS pokemon, (SELECT COUNT(*) FROM cities) AS cities FROM pokemon;"
```

Expected: `pokemon = 151` and `cities = 11`.

- [ ] **Step 4: Validate a relationship query**

Run:

```bash
docker compose exec -T postgres \
  psql -U data_pilot -d pokemon -c \
  "SELECT p.name, string_agg(pt.type_name, '/' ORDER BY pt.slot) AS types FROM pokemon p JOIN pokemon_types pt ON pt.pokemon_id = p.pokedex_number WHERE p.name = 'Charizard' GROUP BY p.name;"
```

Expected: one row for `Charizard` with `fire/flying`.

### Task 3: MongoDB original-trilogy fixture

**Files:**
- Create: `docker/mongodb/init/01-seed.js`

**Interfaces:**
- Consumes root MongoDB user `root` in `admin` from Task 1.
- Produces database user `data_pilot` in `starwars`, with the `readWrite` role only for `starwars`.
- Produces `starwars.characters` and `starwars.planets` collections.
- Documents use fields `slug`, `name`, `episodes`, and the optional or required fields specified in the approved design.

- [ ] **Step 1: Create the MongoDB initializer**

Create `01-seed.js` with the following setup before the fixture arrays:

```javascript
const starwars = db.getSiblingDB('starwars');

starwars.createUser({
  user: 'data_pilot',
  pwd: 'data_pilot',
  roles: [{ role: 'readWrite', db: 'starwars' }],
});

starwars.createCollection('characters');
starwars.createCollection('planets');
starwars.characters.createIndex({ slug: 1 }, { unique: true });
starwars.characters.createIndex({ episodes: 1 });
starwars.planets.createIndex({ slug: 1 }, { unique: true });
starwars.planets.createIndex({ episodes: 1 });
```

- [ ] **Step 2: Add the exact static document fixtures**

Append `insertMany` calls that insert exactly 44 individual named characters
and these seven planetary bodies: Alderaan, Bespin, Dagobah, Endor, Hoth,
Tatooine, and Yavin IV. Every document's `episodes` array must use only
`'IV'`, `'V'`, and/or `'VI'`. A character's `homeworld`, when present, must
either match one of the seven planet slugs or be omitted.

Use data shapes such as:

```javascript
{
  slug: 'luke-skywalker',
  name: 'Luke Skywalker',
  episodes: ['IV', 'V', 'VI'],
  species: 'Human',
  homeworld: 'tatooine',
}

{
  slug: 'tatooine',
  name: 'Tatooine',
  episodes: ['IV', 'VI'],
  classification: 'terrestrial planet',
  terrain: 'desert',
  climate: 'arid',
}
```

End the script with checks that throw if the collection counts are not 44 and
7, or if a document contains an episode outside the three permitted values.

- [ ] **Step 3: Start and validate MongoDB**

Run: `docker compose up -d mongodb && docker compose ps mongodb`

Expected: `mongodb` becomes healthy.

Run:

```bash
docker compose exec -T mongodb mongosh \
  --quiet --username data_pilot --password data_pilot \
  --authenticationDatabase starwars starwars \
  --eval 'printjson({ characters: db.characters.countDocuments(), planets: db.planets.countDocuments() })'
```

Expected JSON has `characters: 44` and `planets: 7`.

- [ ] **Step 4: Validate indexes and trilogy filter**

Run:

```bash
docker compose exec -T mongodb mongosh \
  --quiet --username data_pilot --password data_pilot \
  --authenticationDatabase starwars starwars \
  --eval 'printjson({ indexes: db.planets.getIndexes().map((index) => index.name), invalidEpisodes: db.characters.countDocuments({ episodes: { $elemMatch: { $nin: ["IV", "V", "VI"] } } }) })'
```

Expected: `slug_1` and `episodes_1` are present, and `invalidEpisodes` is 0.

### Task 4: README and end-to-end verification

**Files:**
- Modify: `README.md` in the local development/test database documentation

**Interfaces:**
- Consumes the Compose services and data contracts from Tasks 1–3.
- Produces copy-pastable local lifecycle commands and connection URLs.
- Exercises existing `POST /catalog` and `POST /query` endpoints without changing their request schema.

- [ ] **Step 1: Document lifecycle and preservation semantics**

Add a `## Local test databases` section ahead of `## Test database API` with:

```bash
docker compose up -d
docker compose ps
docker compose logs -f postgres mongodb
docker compose down
# Destructive: removes seeded data and local changes in both database volumes.
docker compose down -v
```

State that normal `down` preserves the named volumes and only `down -v` causes
the initialization scripts to run again on the next start.

- [ ] **Step 2: Document local URLs and API requests**

Document these environment variables:

```bash
export POSTGRES_CONNECTION_URL='postgresql://data_pilot:data_pilot@localhost:5433/pokemon'
export MONGODB_CONNECTION_URL='mongodb://data_pilot:data_pilot@localhost:27018/starwars?authSource=starwars'
```

Add one PostgreSQL query request joining `pokemon` and `pokemon_types` and one
MongoDB `find` request for `planets` filtered by `episodes: 'V'`. Preserve the
existing `NODE_ENV=development` guard instructions.

- [ ] **Step 3: Exercise API catalog and query endpoints**

Start the application with `NODE_ENV=development npm run start:dev` and use
the documented URLs in four `curl` requests: PostgreSQL catalog, PostgreSQL
query, MongoDB catalog, and MongoDB query. Expected catalog entities are the
four PostgreSQL tables and the two MongoDB collections; expected query results
include the Charizard type row and at least one Episode V planet.

- [ ] **Step 4: Prove data persists without volume deletion**

Insert a clearly labelled temporary row/document through `docker compose exec`,
run `docker compose down`, then `docker compose up -d`, and query it back.
Remove only that labelled temporary record afterwards. Do not run `down -v`
against an existing developer volume during validation.

- [ ] **Step 5: Run the project checks**

Run:

```bash
docker compose config --quiet
npm run lint
npm test
npm run build
npm run test:e2e
git diff --check
```

Expected: every command exits 0. Report the Compose database checks separately
from the NestJS tests because they are environment integration checks rather
than part of the Vitest suite.
