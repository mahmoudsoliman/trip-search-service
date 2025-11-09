import { randomUUID } from 'node:crypto';

import Fastify, { type FastifyInstance } from 'fastify';

import type { CachePort } from '../../domain/ports/CachePort';
import type { TripsProvider } from '../../domain/ports/TripsProvider';
import { InMemoryCache } from '../cache/InMemoryCache';
import { config } from '../config';
import { loggerConfig } from '../obs/logger';
import { TripsApiClient } from '../providers/TripsApiClient';
import { registerErrorHandler } from './middlewares/errorHandler';
import { registerRoutes } from './routes';

interface ApplicationDependencies {
  cache: CachePort;
  tripsProvider: TripsProvider;
}

export function buildServer(
  overrides: Partial<ApplicationDependencies> = {},
): FastifyInstance {
  const dependencies = createDependencies(overrides);

  const app = Fastify({
    logger: { ...loggerConfig },
    genReqId: () => randomUUID(),
  });

  registerErrorHandler(app);
  registerRoutes(app, {
    cache: dependencies.cache,
    tripsProvider: dependencies.tripsProvider,
    searchCacheTtlSeconds: config.CACHE_TTL_SEARCH_SECONDS,
  });

  app.addHook('onClose', async () => {
    await disconnectCache(dependencies.cache);
  });

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

function createDependencies(
  overrides: Partial<ApplicationDependencies>,
): ApplicationDependencies {
  if (!config.TRIPS_API_BASE_URL && !overrides.tripsProvider) {
    throw new Error(
      'TRIPS_API_BASE_URL must be configured or a trips provider implementation must be provided',
    );
  }

  const cache =
    overrides.cache ??
    new InMemoryCache();

  const tripsProvider =
    overrides.tripsProvider ??
    new TripsApiClient({
      baseUrl: config.TRIPS_API_BASE_URL!,
      apiKey: config.TRIPS_API_KEY,
      timeoutMs: config.REQUEST_TIMEOUT_MS,
      retryAttempts: config.RETRY_ATTEMPTS,
    });

  return { cache, tripsProvider };
}

async function disconnectCache(cache: CachePort): Promise<void> {
  const candidate = cache as CachePort & { disconnect?: () => Promise<void> };
  if (typeof candidate.disconnect === 'function') {
    await candidate.disconnect();
  }
}
