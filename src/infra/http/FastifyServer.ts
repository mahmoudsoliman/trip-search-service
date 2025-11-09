import { randomUUID } from 'node:crypto';

import Fastify, { type FastifyInstance } from 'fastify';

import { config } from '../config';
import { logger } from '../obs/logger';
import { registerErrorHandler } from './middlewares/errorHandler';
import { registerRoutes } from './routes';

export function buildServer(): FastifyInstance {
  const app = Fastify({
    logger,
    genReqId: () => randomUUID()
  });

  registerErrorHandler(app);
  app.register(registerRoutes);

  return app;
}

export async function startServer(): Promise<void> {
  const app = buildServer();

  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

