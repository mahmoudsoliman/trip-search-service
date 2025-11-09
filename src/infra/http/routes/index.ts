import type { FastifyInstance } from 'fastify';

import type { CachePort } from '../../../domain/ports/CachePort';
import type { TripsProvider } from '../../../domain/ports/TripsProvider';
import { registerTripsRoutes } from './tripsRoutes';

export interface RouteDependencies {
  cache: CachePort;
  tripsProvider: TripsProvider;
  searchCacheTtlSeconds: number;
}

export function registerRoutes(app: FastifyInstance, dependencies: RouteDependencies): void {
  registerTripsRoutes(app, dependencies);
}

