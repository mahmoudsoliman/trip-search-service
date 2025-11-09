# Trip Search Service

Fastify + TypeScript API that integrates with third-party trip search providers, persists saved trip snapshots per user, and exposes Redis-backed caching. The project follows a clean/hexagonal architecture with domain-driven design influences.

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+
- Docker and Docker Compose (for Redis and local DB support)

### Installation
```bash
npm install
```

### Environment
Copy `.env.example` to `.env` and adjust settings for your environment.

### Database
Generate the Prisma client and apply migrations (SQLite by default):
```bash
npm run prisma:generate
npm run prisma:migrate
```

### Development
Start the development server with auto-reload:
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

### Testing
Run tests and coverage with Vitest:
```bash
npm test
npm run coverage
```

### Docker Compose
Bring up the API (after building) and Redis cache:
```bash
docker-compose up --build
```

## Project Structure
```
src/
  domain/
  app/
  infra/
  presentation/
  utils/
prisma/
tests/
```

## License
MIT
