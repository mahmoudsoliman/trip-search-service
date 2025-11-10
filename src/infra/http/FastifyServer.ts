import { randomUUID } from 'node:crypto';

import Fastify, { type FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

import type { CachePort } from '../../domain/ports/CachePort';
import type { TripsProvider } from '../../domain/ports/TripsProvider';
import type { UserRepository } from '../../domain/ports/UserRepository';
import type { SavedTripsRepository } from '../../domain/ports/SavedTripsRepository';
import { InMemoryCache } from '../cache/InMemoryCache';
import { config } from '../config';
import { createAuth0JwtVerifier, type VerifyAccessToken } from '../auth/auth0Jwt';
import { loggerConfig } from '../obs/logger';
import { TripsApiClient } from '../providers/TripsApiClient';
import { PrismaUserRepository } from '../repos/PrismaUserRepository';
import { PrismaSavedTripsRepository } from '../repos/PrismaSavedTripsRepository';
import { authPlugin } from './middlewares/authPlugin';
import { registerErrorHandler } from './middlewares/errorHandler';
import { registerRoutes } from './routes';
import { Auth0ManagementClient } from '../providers/Auth0ManagementClient';
import type { Auth0ManagementClient as Auth0ManagementClientPort } from '../../domain/ports/Auth0ManagementClient';

interface ApplicationDependencies {
  cache: CachePort;
  tripsProvider: TripsProvider;
  userRepository: UserRepository;
  savedTripsRepository: SavedTripsRepository;
  verifyAccessToken: VerifyAccessToken;
  auth0ManagementClient: Auth0ManagementClientPort;
  prismaClient?: PrismaClient;
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
  app.register(authPlugin, {
    verifyAccessToken: dependencies.verifyAccessToken,
    userRepository: dependencies.userRepository,
  });
  registerRoutes(app, {
    cache: dependencies.cache,
    tripsProvider: dependencies.tripsProvider,
    searchCacheTtlSeconds: config.CACHE_TTL_SEARCH_SECONDS,
    userRepository: dependencies.userRepository,
    auth0ManagementClient: dependencies.auth0ManagementClient,
    savedTripsRepository: dependencies.savedTripsRepository,
    savedTripsCacheTtlSeconds: config.CACHE_TTL_SAVED_TRIPS_SECONDS,
  });

  const prismaClient = dependencies.prismaClient;

  app.addHook('onClose', async () => {
    await disconnectCache(dependencies.cache);
    if (prismaClient) {
      await prismaClient.$disconnect();
    }
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

  if ((!config.AUTH0_ISSUER || !config.AUTH0_AUDIENCE) && !overrides.verifyAccessToken) {
    throw new Error(
      'AUTH0_ISSUER and AUTH0_AUDIENCE must be configured or a verifyAccessToken implementation must be provided',
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

  let prismaClient: PrismaClient | undefined = overrides.prismaClient;
  let userRepository: UserRepository | undefined = overrides.userRepository;
  let savedTripsRepository: SavedTripsRepository | undefined = overrides.savedTripsRepository;

  if (!userRepository) {
    prismaClient ??= new PrismaClient();
    userRepository = new PrismaUserRepository(prismaClient);
  }

  if (!savedTripsRepository) {
    prismaClient ??= new PrismaClient();
    savedTripsRepository = new PrismaSavedTripsRepository(prismaClient);
  }

  const verifyAccessToken =
    overrides.verifyAccessToken ??
    createAuth0JwtVerifier({
      issuer: config.AUTH0_ISSUER!,
      audience: config.AUTH0_AUDIENCE!,
    });

  if (
    (!config.AUTH0_MGMT_CLIENT_ID ||
      !config.AUTH0_MGMT_CLIENT_SECRET ||
      !config.AUTH0_ISSUER) &&
    !overrides.auth0ManagementClient
  ) {
    throw new Error(
      'Auth0 management credentials must be configured or an auth0ManagementClient provided',
    );
  }

  const auth0ManagementClient =
    overrides.auth0ManagementClient ??
    new Auth0ManagementClient({
      domain: ensureTrailingSlash(config.AUTH0_ISSUER!),
      clientId: config.AUTH0_MGMT_CLIENT_ID!,
      clientSecret: config.AUTH0_MGMT_CLIENT_SECRET!,
      audience: config.AUTH0_MGMT_AUDIENCE ?? `${ensureTrailingSlash(config.AUTH0_ISSUER!)}api/v2/`,
      connection: config.AUTH0_CONNECTION,
      scope: config.AUTH0_MGMT_SCOPES,
    });

  return {
    cache,
    tripsProvider,
    userRepository,
    savedTripsRepository,
    verifyAccessToken,
    auth0ManagementClient,
    prismaClient,
  };
}

async function disconnectCache(cache: CachePort): Promise<void> {
  const candidate = cache as CachePort & { disconnect?: () => Promise<void> };
  if (typeof candidate.disconnect === 'function') {
    await candidate.disconnect();
  }
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}
