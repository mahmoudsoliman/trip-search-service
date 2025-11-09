# Trip Search Service

Fastify + TypeScript API that integrates with third-party trip search providers and persists saved trip snapshots per user. The project follows a clean/hexagonal architecture with domain-driven design influences.

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+
- Docker and Docker Compose (for optional containerised runs)

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
Build and start the API in a container:
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
