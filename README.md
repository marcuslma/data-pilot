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

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Local test databases

Docker Desktop (or Docker Engine with Compose) is required. The local stack
starts PostgreSQL on port `5433` and MongoDB on port `27018`, avoiding the
usual local ports `5432` and `27017`.

```bash
# Start and seed both databases the first time their named volumes are created.
docker compose up -d
docker compose ps

# Follow database logs.
docker compose logs -f postgres mongodb

# Stop containers while preserving all local data.
docker compose down

# Destructive: delete both named volumes. The next start seeds them again.
docker compose down -v
```

PostgreSQL is seeded with Kanto, eleven Kanto locations, all 151 Generation I
Pokémon, and their original Generation I types. MongoDB is seeded with 44
named characters and seven planetary bodies from the original Star Wars
trilogy (Episodes IV–VI).

These development-only credentials are intentionally local and must not be
used outside this Compose stack:

```bash
export POSTGRES_CONNECTION_URL='postgresql://data_pilot:data_pilot@localhost:5433/pokemon'
export MONGODB_CONNECTION_URL='mongodb://data_pilot:data_pilot@localhost:27018/starwars?authSource=starwars'
export API_BASE_URL='http://localhost:3000'
```

## Application configuration

Copy `.env.example` to an untracked `.env` file and set a real OpenAI key before
starting the API. Configuration is validated during application startup; the
process does not listen for HTTP requests when a required value is absent or
invalid.

```bash
cp .env.example .env
# Edit .env and set OPENAI_API_KEY to a real key.
```

`NODE_ENV` is required and accepts `development`, `test`, or `production`.
`PORT` is optional and defaults to `3000`; it must be an integer from `1` to
`65535`. `OPENAI_API_KEY` is required and must not be blank. `OPENAI_MODEL`
defaults to `gpt-5-nano`, `OPENAI_REASONING_EFFORT` defaults to `medium`, and
the three `MAX_ASK_*` limits default to `10`, `100`, and `50000` respectively.

NestJS Observe is optional, but `OBSERVE_APP_KEY` and `OBSERVE_APP_SECRET` must
be configured together. Supplying only one is a startup error. When both are
absent, telemetry remains disabled; `OBSERVE_SERVICE_ID` defaults to
`data-pilot`.

The API currently enables open CORS globally during this development phase: any
browser origin may make requests, while credentialed CORS requests remain
disabled. Replace this with an explicit origin allowlist before exposing
authenticated or sensitive operations.

## Test database API

The test database API is available only when `NODE_ENV` is exactly `development` or `test`.
Connections are short-lived and their sources, credentials, and metadata are not persisted.
Use only test or read-only database accounts, and keep connection details in environment
variables rather than committing them to source control.

Start the API in development mode:

```bash
npm run start:dev
```

List the catalog for a temporary source:

```bash
curl -X POST "${API_BASE_URL}/catalog" \
  -H 'Content-Type: application/json' \
  -d '{"source":{"kind":"postgres","connectionUrl":"'"${POSTGRES_CONNECTION_URL}"'"}}'
```

Run one read-only PostgreSQL query against the Kanto seed:

```bash
curl -X POST "${API_BASE_URL}/query" \
  -H 'Content-Type: application/json' \
  -d '{"source":{"kind":"postgres","connectionUrl":"'"${POSTGRES_CONNECTION_URL}"'"},"query":{"language":"sql","text":"SELECT p.name, string_agg(pt.type_name, '\''/'\'' ORDER BY pt.slot) AS types FROM pokemon p JOIN pokemon_types pt ON pt.pokemon_id = p.pokedex_number WHERE p.name = '\''Charizard'\'' GROUP BY p.name"}}'
```

List the MongoDB catalog:

```bash
curl -X POST "${API_BASE_URL}/catalog" \
  -H 'Content-Type: application/json' \
  -d '{"source":{"kind":"mongodb","connectionUrl":"'"${MONGODB_CONNECTION_URL}"'"}}'
```

Run one MongoDB `find` query against the original-trilogy seed:

```bash
curl -X POST "${API_BASE_URL}/query" \
  -H 'Content-Type: application/json' \
  -d '{"source":{"kind":"mongodb","connectionUrl":"'"${MONGODB_CONNECTION_URL}"'"},"query":{"language":"mongo","operation":"find","collection":"planets","filter":{"episodes":"V"},"sort":{"name":1}}}'
```

## AI-assisted query API

`POST /ask` is available only when `NODE_ENV` is exactly `development` or
`test`. It accepts temporary sources, does not persist sources or results, and
uses OpenAI to create at most one read-only query per supplied source. The
application inspects the catalog first and reuses the PostgreSQL and MongoDB
query validation performed by `/query` before executing anything.

`OPENAI_API_KEY` is required when the application starts, not only when calling
this endpoint. A missing or invalid key prevents startup, so `/ask` no longer
has a request-time `503 Service Unavailable` fallback for absent configuration.
`OPENAI_MODEL` is optional and defaults to `gpt-5-nano`;
`OPENAI_REASONING_EFFORT` is optional and defaults to `medium`. OpenAI requests
can incur usage charges.

```bash
export OPENAI_API_KEY='your-api-key'
export OPENAI_MODEL='gpt-5-nano'
export OPENAI_REASONING_EFFORT='medium'
```

`OPENAI_MODEL` accepts `gpt-5-nano`, `gpt-5.6-luna`, `gpt-5.6-terra`, or
`gpt-5.6-sol`; it defaults to `gpt-5-nano` when omitted.

`OPENAI_REASONING_EFFORT` accepts `none`, `low`, `medium`, `high`, `xhigh`,
or `max`; it defaults to `medium` when omitted.

The provider receives only opaque source IDs, source types, and catalog
metadata. It never receives database connection URLs or credentials. The
response contains a Portuguese answer plus the executed queries and their raw
results for auditability. If one source cannot be accessed, a successful query
from another source can still produce a partial answer.

The endpoint limits the request to `MAX_ASK_SOURCES` sources (default `10`).
For the answer synthesis only, it sends at most
`MAX_ASK_SUMMARY_ROWS_PER_EXECUTION` rows per successful query (default `100`)
and at most `MAX_ASK_SUMMARY_CONTENT_CHARS` serialized characters across all
queries (default `50000`). Full adapter results remain in the API response; a
`truncatedForSummary` field identifies a result that was reduced before being
sent to the provider.

```bash
curl -X POST "${API_BASE_URL}/ask" \
  -H 'Content-Type: application/json' \
  -d '{"question":"Quantos Pokémon existem em Kanto?","sources":[{"kind":"postgres","connectionUrl":"'"${POSTGRES_CONNECTION_URL}"'"}]}'
```

## Relationship suggestions API

`POST /relationship-suggestions` is available only when `NODE_ENV` is exactly
`development` or `test`. It inspects two or more temporary sources and returns
ranked, explainable candidate relationships between fields. Profiling uses
bounded samples locally; raw values and fingerprints are not returned, and
the suggestions are not persisted.

```bash
curl -X POST "${API_BASE_URL}/relationship-suggestions" \
  -H 'Content-Type: application/json' \
  -d '{"sources":[{"sourceId":"pokemon","source":{"kind":"postgres","connectionUrl":"'"${POSTGRES_CONNECTION_URL}"'"}},{"sourceId":"characters","source":{"kind":"mongodb","connectionUrl":"'"${MONGODB_CONNECTION_URL}"'"}}]}'
```

After reviewing or correcting the candidates, validate the mapping with
`POST /relationships/validate`. The route re-inspects the sources and accepts
only endpoints and type families that exist in the current catalogs.

```bash
curl -X POST "${API_BASE_URL}/relationships/validate" \
  -H 'Content-Type: application/json' \
  -d '{"sources":[{"sourceId":"crm","source":{"kind":"postgres","connectionUrl":"'"${POSTGRES_CONNECTION_URL}"'"}},{"sourceId":"billing","source":{"kind":"mongodb","connectionUrl":"'"${MONGODB_CONNECTION_URL}"'"}}],"relationships":[{"left":{"sourceId":"crm","namespace":"public","entity":"customers","field":"id"},"right":{"sourceId":"billing","namespace":"billing","entity":"orders","field":"customer_id"},"operator":"equals","cardinality":"one-to-many","joinType":"left"}]}'
```

Validated mappings are not persisted and are not consumed by `/ask` yet. Cross-
source query execution will use this source-independent contract in a later
phase.

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observer](https://observer.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
