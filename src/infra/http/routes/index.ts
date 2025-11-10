import type { FastifyInstance } from 'fastify';

import type { PrismaClient } from '@prisma/client';

import type { CachePort } from '../../../domain/ports/CachePort';
import type { TripsProvider } from '../../../domain/ports/TripsProvider';
import type { Auth0ManagementClient } from '../../../domain/ports/Auth0ManagementClient';
import type { UserRepository } from '../../../domain/ports/UserRepository';
import type { SavedTripsRepository } from '../../../domain/ports/SavedTripsRepository';
import { registerMeRoutes } from './meRoutes';
import { registerTripsRoutes } from './tripsRoutes';
import { registerUsersRoutes } from './usersRoutes';
import { registerSystemRoutes } from './systemRoutes';

export interface RouteDependencies {
  cache: CachePort;
  tripsProvider: TripsProvider;
  searchCacheTtlSeconds: number;
  userRepository: UserRepository;
  auth0ManagementClient: Auth0ManagementClient;
  savedTripsRepository: SavedTripsRepository;
  savedTripsCacheTtlSeconds: number;
  prismaClient?: PrismaClient;
  tripsApiBaseUrl?: string;
}

export function registerRoutes(app: FastifyInstance, dependencies: RouteDependencies): void {
  registerTripsRoutes(app, dependencies);
  registerMeRoutes(app, {
    savedTripsRepository: dependencies.savedTripsRepository,
    cache: dependencies.cache,
    savedTripsCacheTtlSeconds: dependencies.savedTripsCacheTtlSeconds,
    tripsProvider: dependencies.tripsProvider,
  });
  registerUsersRoutes(app, {
    userRepository: dependencies.userRepository,
    auth0ManagementClient: dependencies.auth0ManagementClient,
  });
  registerSystemRoutes(app, {
    cache: dependencies.cache,
    prismaClient: dependencies.prismaClient,
    tripsApiBaseUrl: dependencies.tripsApiBaseUrl,
  });
}