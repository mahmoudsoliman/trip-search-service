# Trip Search Service

A Fastify + TypeScript API for searching trips from a third‑party provider, caching results, and persisting user saved-trip snapshots. Authentication is handled via Auth0, users are automatically provisioned on first request, and data is stored through Prisma (SQLite by default). The implementation follows a Clean/Hexagonal architecture with domain-driven influences.

## Features at a Glance

- **Trip Search with Sorting & Caching**
  - `GET /v1/trips/search?origin=SYD&destination=GRU&sort_by=cheapest|fastest`
  - Hits the external trips API (via `TripsApiClient`), sorts using `TripSorter`, and caches results with either Redis or in-memory Map (`CachePort` implementation).
  - Cache TTL is configurable via `CACHE_TTL_SEARCH_SECONDS`.

- **Authentication & User Provisioning**
  - Auth0 JWT guard validates incoming tokens (issuer + audience) and attaches claims to the request.
  - The guard invokes the `ensureUser` use case, creating/updating a local user record through the `UserRepository`.
  - All `/v1/me/*` routes require a bearer token (or rely on the `AUTH_BYPASS` dev mode).

- **Saved Trip Snapshots**
  - `POST /v1/me/saved-trips` accepts a `tripId`, fetches the latest snapshot from the provider, and upserts it via `SavedTripsRepository`.
  - `GET /v1/me/saved-trips` reads from cache first (`CACHE_TTL_SAVED_TRIPS_SECONDS`), hitting the database only on cache miss.
  - `DELETE /v1/me/saved-trips/:externalTripId` removes the record and invalidates the cache.
  - Snapshots are stored in the `UserSavedTrip` Prisma model (`sqlite` default), capturing origin/destination, cost, duration, type, and display name.

- **Explicit User Registration**
  - `POST /v1/users` calls the Auth0 Management API (via `Auth0ManagementClient` port) to create a user in Auth0 and persist it locally.

- **Operational Tooling**
  - `/health` (liveness) and `/ready` (readiness) endpoints with cached, database, and trips API checks.
  - Swagger UI at `/docs` (`@fastify/swagger` + `swagger-ui`).
  - Structured logging via `pino`, with optional pretty logging in development.
  - Docker Compose support for API + Redis + SQLite sidecar.

- **Clean Architecture Layers**
  - `domain/`: Entity definitions (`User`, `SavedTrip`) and port interfaces (`TripsProvider`, `UserRepository`, `CachePort`, `Auth0ManagementClient`).
  - `app/`: Use cases (`searchTrips`, `ensureUser`, `saveUserTrip`, etc.) orchestrating domain logic.
  - `infra/`: Adapter implementations (Fastify server/routes, Prisma repos, Auth0 client, trips provider, cache adapters).
  - `presentation/`: Zod schemas and response mappers isolating HTTP payload concerns.


## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+
- Docker & Docker Compose (optional, for containerised runs)

### Install & Configure
```bash
npm install
cp .env.example .env
```
Populate the `.env` file with your Auth0 tenant details, trips API credentials, and Redis connection string (or leave `REDIS_URL` unset to fall back to in-memory caching locally).

### Database
Generate the Prisma client and apply migrations (SQLite by default):
```bash
npm run prisma:generate
npm run prisma:migrate
```

### Run Locally
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

### Tests
```bash
npm test
npm run coverage
```

### Docker Compose
Spin up the API with SQLite and Redis sidecars:
```bash
docker compose up --build
```

## Environment Variables

| Variable | Description |
| --- | --- |
| `NODE_ENV` | `development` \| `test` \| `production` |
| `PORT` | HTTP port (default `3000`) |
| `LOG_LEVEL` | Pino log level (defaults to `debug` in dev, `info` otherwise) |
| `TRIPS_API_BASE_URL` | Base URL of the third-party trips API |
| `TRIPS_API_KEY` | Optional API key header value |
| `AUTH0_ISSUER` | Auth0 issuer (e.g. `https://tenant.eu.auth0.com/`) |
| `AUTH0_AUDIENCE` | API audience to validate incoming JWTs |
| `AUTH0_MGMT_CLIENT_ID` / `AUTH0_MGMT_CLIENT_SECRET` | Machine-to-machine credentials for Auth0 Management API |
| `AUTH0_MGMT_AUDIENCE` | Management API audience (defaults to `<issuer>api/v2/`) |
| `AUTH0_MGMT_SCOPES` | Space-separated scopes (e.g. `create:users read:users`) |
| `AUTH0_CONNECTION` | Auth0 database connection name |
| `AUTH_BYPASS` | Set to `true` to bypass JWT verification and use a dummy user (dev only) |
| `DATABASE_URL` | Prisma connection string (SQLite by default) |
| `REDIS_URL` | Redis connection URI (omit to use in-memory cache) |
| `CACHE_TTL_SEARCH_SECONDS` | TTL for trip search cache entries |
| `CACHE_TTL_SAVED_TRIPS_SECONDS` | TTL for saved trips cache entries |
| `REQUEST_TIMEOUT_MS` | Default HTTP timeout for external calls |
| `RETRY_ATTEMPTS` | Retry attempts for trips provider requests |

## HTTP Surface

| Method & Path | Description |
| --- | --- |
| `GET /v1/trips/search` | Public endpoint that proxies the trips provider with sorting and caching. |
| `GET /v1/me/saved-trips` | Lists the caller’s saved trip snapshots (cached). |
| `POST /v1/me/saved-trips` | Saves a trip by ID (fetches snapshot from provider, invalidates cache). |
| `DELETE /v1/me/saved-trips/:externalTripId` | Removes a saved trip and invalidates cache. |
| `POST /v1/users` | Explicitly register a user both locally and in Auth0. |
| `GET /health` | Liveness probe. |
| `GET /ready` | Readiness probe (checks DB, cache, and trips API availability). |
| `GET /docs` | Swagger UI for the API. |

All `/v1/me/*` endpoints expect an Auth0-issued Bearer token; the authentication plugin will automatically provision a local user record on first use.

### Health & Readiness
- `/health` simply returns `{ "status": "ok" }`.
- `/ready` performs:
  - `SELECT 1` against the Prisma datasource (skipped if Prisma isn’t configured).
  - A cache probe (`set` + `delete`) against the injected cache adapter.
  - A `HEAD` probe against the configured trips API base URL with a 500 ms timeout.
If any mandatory dependency fails, the route responds with `503` and per-check details.

### API Docs
Swagger UI is available at `http://localhost:3000/docs`. The generated OpenAPI document declares HTTP bearer authentication (JWT) for protected routes.

### Auth Bypass (Local Convenience)
If you don’t have Auth0 set up, you can flip `AUTH_BYPASS=true` in `.env`. The server will:
- Skip JWT verification and attach a synthetic `dev|bypass-user`.
- Disable the `/v1/users` route (it will respond with an error telling you to provide Auth0 credentials).

This mode lets you exercise the trips and saved-trips workflow without issuing real tokens.

## Architecture Overview

```
domain/      — Entities + ports (pure business contracts)
app/         — Use cases orchestrating domain operations
infra/       — Adapters (Fastify, Prisma, Redis, Auth0, trips provider)
presentation/— DTO mappers and request/response schemas
utils/       — Cross-cutting concerns (errors, helpers)
tests/       — Vitest unit and integration suites
```

- **Domain** stays framework agnostic and exposes interfaces (`UserRepository`, `TripsProvider`, `CachePort`,…).
- **Application** orchestrates domain behaviour (search, ensure user, save/list/delete trips).
- **Infrastructure/Presentation** implement adapters: Fastify routes, Prisma repositories, Redis cache, Auth0 client, third-party trips client.
- Dependencies always point inwards (outer layers call inner ones, never the reverse).

## License
MIT
