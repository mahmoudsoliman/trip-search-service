import type { SavedTripSnapshot } from '../../domain/SavedTrip';
import type { CachePort } from '../../domain/ports/CachePort';
import type { SavedTripsRepository } from '../../domain/ports/SavedTripsRepository';

interface ListUserSavedTripsDependencies {
  savedTripsRepository: SavedTripsRepository;
  cache: CachePort;
  cacheTtlSeconds: number;
  cacheKeyBuilder?: (userId: string) => string;
}

interface ListUserSavedTripsInput {
  userId: string;
}

interface CachedSavedTrip {
  id: string;
  userId: string;
  externalTripId: string;
  origin: string;
  destination: string;
  cost: number;
  duration: number;
  type: string;
  displayName: string;
  savedAt: string;
  fetchedAt: string;
}

export async function listUserSavedTrips(
  dependencies: ListUserSavedTripsDependencies,
  input: ListUserSavedTripsInput,
): Promise<SavedTripSnapshot[]> {
  const cacheKey =
    dependencies.cacheKeyBuilder?.(input.userId) ?? buildSavedTripsCacheKey(input.userId);

  const cached = await dependencies.cache.get<CachedSavedTrip[]>(cacheKey);
  if (cached) {
    return cached.map(deserializeSavedTrip);
  }

  const trips = await dependencies.savedTripsRepository.listByUserId(input.userId);

  try {
    await dependencies.cache.set(
      cacheKey,
      trips.map(serializeSavedTrip),
      dependencies.cacheTtlSeconds,
    );
  } catch {
    // Cache failures should not block the response
  }

  return trips;
}

export function buildSavedTripsCacheKey(userId: string): string {
  return `user:${userId}:savedTrips`;
}

function serializeSavedTrip(savedTrip: SavedTripSnapshot): CachedSavedTrip {
  return {
    ...savedTrip,
    savedAt: savedTrip.savedAt.toISOString(),
    fetchedAt: savedTrip.fetchedAt.toISOString(),
  };
}

function deserializeSavedTrip(savedTrip: CachedSavedTrip): SavedTripSnapshot {
  return {
    ...savedTrip,
    savedAt: new Date(savedTrip.savedAt),
    fetchedAt: new Date(savedTrip.fetchedAt),
  };
}

