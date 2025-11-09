import type { FastifyInstance } from 'fastify';

export function registerRoutes(app: FastifyInstance): void {
  app.get('/', () => ({
    status: 'ok',
  }));
}

