import type { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

import type { CachePort } from '../../../domain/ports/CachePort';

interface SystemRouteDependencies {
  cache: CachePort;
  prismaClient?: PrismaClient;
  tripsApiBaseUrl?: string;
}

type CheckStatus = 'ok' | 'error' | 'skipped';

interface CheckResult {
  status: CheckStatus;
  error?: string;
}

export function registerSystemRoutes(
  app: FastifyInstance,
  dependencies: SystemRouteDependencies,
): void {
  app.get('/health', async (_request, reply) => {
    void reply.status(200);
    return { status: 'ok' };
  });

  app.get('/ready', async (_request, reply) => {
    const [database, cache, tripsApi] = await Promise.all([
      checkDatabase(dependencies.prismaClient),
      checkCache(dependencies.cache),
      checkTripsApi(dependencies.tripsApiBaseUrl),
    ]);

    const checks = {
      database,
      cache,
      tripsApi,
    };

    const isReady = Object.values(checks).every(
      (result) => result.status === 'ok' || result.status === 'skipped',
    );

    void reply.status(isReady ? 200 : 503);

    return {
      status: isReady ? 'ok' : 'error',
      checks,
    };
  });
}

async function checkDatabase(prismaClient?: PrismaClient): Promise<CheckResult> {
  if (!prismaClient) {
    return { status: 'skipped' };
  }

  try {
    await prismaClient.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  } catch (error) {
    return { status: 'error', error: normalizeError(error) };
  }
}

async function checkCache(cache: CachePort): Promise<CheckResult> {
  const probeKey = `ready:probe:${Date.now()}`;
  const payload = { timestamp: Date.now() };

  try {
    await cache.set(probeKey, payload, 1);
    await cache.delete(probeKey);
    return { status: 'ok' };
  } catch (error) {
    return { status: 'error', error: normalizeError(error) };
  }
}

async function checkTripsApi(tripsApiBaseUrl?: string): Promise<CheckResult> {
  if (!tripsApiBaseUrl) {
    return { status: 'skipped' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 500);

  try {
    const url = new URL('/', ensureTrailingSlash(tripsApiBaseUrl));
    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
    });

    if (response.status >= 500) {
      return {
        status: 'error',
        error: `Trips API responded with ${response.status} ${response.statusText}`,
      };
    }

    return { status: 'ok' };
  } catch (error) {
    return { status: 'error', error: normalizeError(error) };
  } finally {
    clearTimeout(timeout);
  }
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
}

