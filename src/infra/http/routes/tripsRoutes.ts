import type { FastifyInstance } from 'fastify';

import { TripSorter } from '../../../app/services/TripSorter';
import { searchTrips } from '../../../app/use-cases/searchTrips';
import { ValidationError } from '../../../utils/errors';
import { searchQuerySchema } from '../../../presentation/schemas/searchQuery.schema';
import type { RouteDependencies } from '.';

const tripSorter = new TripSorter();

export function registerTripsRoutes(
  app: FastifyInstance,
  dependencies: RouteDependencies,
): void {
  app.get('/v1/trips/search', async (request, reply) => {
    const validatedQuery = searchQuerySchema.safeParse(request.query);

    if (!validatedQuery.success) {
      throw new ValidationError('Invalid query parameters', {
        issues: validatedQuery.error.issues,
      });
    }

    const trips = await searchTrips(
      {
        cache: dependencies.cache,
        cacheTtlSeconds: dependencies.searchCacheTtlSeconds,
        tripsProvider: dependencies.tripsProvider,
        sorter: tripSorter,
      },
      {
        origin: validatedQuery.data.origin,
        destination: validatedQuery.data.destination,
        sortBy: validatedQuery.data.sort_by,
      },
    );

    void reply.status(200).send({ trips });
  });
}

