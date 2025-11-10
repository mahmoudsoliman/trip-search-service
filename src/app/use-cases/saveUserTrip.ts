import type { SavedTripSnapshot, Trip } from '../../domain/SavedTrip';
import type { CachePort } from '../../domain/ports/CachePort';
import type { SaveTripInput, SavedTripsRepository } from '../../domain/ports/SavedTripsRepository';
import type { TripsProvider } from '../../domain/ports/TripsProvider';
import { NotFoundError } from '../../utils/errors';
import { buildSavedTripsCacheKey } from './listUserSavedTrips';

export interface SaveUserTripInput {
  userId: string;
  tripId: string;
}

export interface SaveUserTripDependencies {
  savedTripsRepository: SavedTripsRepository;
  cache: CachePort;
  cacheKeyBuilder?: (userId: string) => string;
  tripsProvider: TripsProvider;
}

export async function saveUserTrip(
  dependencies: SaveUserTripDependencies,
  input: SaveUserTripInput,
): Promise<SavedTripSnapshot> {
  const trip = await dependencies.tripsProvider.getTripById(input.tripId);

  if (!trip) {
    throw new NotFoundError('Trip not found', { tripId: input.tripId });
  }

  const record = await dependencies.savedTripsRepository.upsert(
    normalizeInput(input.userId, trip),
  );

  const cacheKey =
    dependencies.cacheKeyBuilder?.(input.userId) ?? buildSavedTripsCacheKey(input.userId);

  try {
    await dependencies.cache.delete(cacheKey);
  } catch {
    // Cache invalidation failure should not block the request.
  }

  return record;
}

function normalizeInput(userId: string, trip: Trip): SaveTripInput {
  return {
    userId,
    trip,
    fetchedAt: new Date(),
  };
}

