import type { FastifyInstance } from 'fastify';

import { saveUserTrip } from '../../../app/use-cases/saveUserTrip';
import { listUserSavedTrips, buildSavedTripsCacheKey } from '../../../app/use-cases/listUserSavedTrips';
import { deleteUserSavedTrip } from '../../../app/use-cases/deleteUserSavedTrip';
import type { CachePort } from '../../../domain/ports/CachePort';
import type { SavedTripsRepository } from '../../../domain/ports/SavedTripsRepository';
import type { TripsProvider } from '../../../domain/ports/TripsProvider';
import { mapSavedTrip } from '../../../presentation/mappers/savedTripMapper';
import { saveUserTripSchema } from '../../../presentation/schemas/saveUserTrip.schema';
import { ValidationError } from '../../../utils/errors';

interface MeRouteDependencies {
  savedTripsRepository: SavedTripsRepository;
  cache: CachePort;
  savedTripsCacheTtlSeconds: number;
  tripsProvider: TripsProvider;
}

export function registerMeRoutes(
  app: FastifyInstance,
  dependencies: MeRouteDependencies,
): void {
  app.register((instance, _opts, done) => {
    instance.addHook('preHandler', async (request, reply) => {
      await instance.authenticate(request, reply);
    });

    instance.get('/v1/me/profile', async (request, reply) => {
      if (!request.currentUser) {
        void reply.status(500);
        return { error: 'User context missing' };
      }

      return {
        user: {
          id: request.currentUser.id,
          auth0Sub: request.currentUser.auth0Sub,
          email: request.currentUser.email,
          name: request.currentUser.name,
          createdAt: request.currentUser.createdAt,
          updatedAt: request.currentUser.updatedAt,
        },
      };
    });

    instance.post('/v1/me/saved-trips', async (request, reply) => {
      if (!request.currentUser) {
        void reply.status(500);
        return { error: 'User context missing' };
      }

      const parsed = saveUserTripSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Invalid saved trip payload', {
          issues: parsed.error.issues,
        });
      }

      const savedTrip = await saveUserTrip(
        {
          savedTripsRepository: dependencies.savedTripsRepository,
          cache: dependencies.cache,
          tripsProvider: dependencies.tripsProvider,
          cacheKeyBuilder: buildSavedTripsCacheKey,
        },
        {
          userId: request.currentUser.id,
          tripId: parsed.data.tripId,
        },
      );

      void reply.status(201);
      return {
        savedTrip: mapSavedTrip(savedTrip),
      };
    });

    instance.get('/v1/me/saved-trips', async (request, reply) => {
      if (!request.currentUser) {
        void reply.status(500);
        return { error: 'User context missing' };
      }

      const trips = await listUserSavedTrips(
        {
          savedTripsRepository: dependencies.savedTripsRepository,
          cache: dependencies.cache,
          cacheTtlSeconds: dependencies.savedTripsCacheTtlSeconds,
          cacheKeyBuilder: buildSavedTripsCacheKey,
        },
        {
          userId: request.currentUser.id,
        },
      );

      void reply.status(200);
      return {
        savedTrips: trips.map(mapSavedTrip),
      };
    });

    instance.delete('/v1/me/saved-trips/:externalTripId', async (request, reply) => {
      if (!request.currentUser) {
        void reply.status(500);
        return { error: 'User context missing' };
      }

      const externalTripId = (request.params as { externalTripId: string }).externalTripId;

      await deleteUserSavedTrip(
        {
          savedTripsRepository: dependencies.savedTripsRepository,
          cache: dependencies.cache,
          cacheKeyBuilder: buildSavedTripsCacheKey,
        },
        {
          userId: request.currentUser.id,
          externalTripId,
        },
      );

      void reply.status(204);
      return null;
    });

    done();
  });
}
