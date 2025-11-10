import type { CachePort } from '../../domain/ports/CachePort';
import type { SavedTripsRepository } from '../../domain/ports/SavedTripsRepository';
import { NotFoundError } from '../../utils/errors';
import { buildSavedTripsCacheKey } from './listUserSavedTrips';

interface DeleteUserSavedTripInput {
  userId: string;
  externalTripId: string;
}

interface DeleteUserSavedTripDependencies {
  savedTripsRepository: SavedTripsRepository;
  cache: CachePort;
  cacheKeyBuilder?: (userId: string) => string;
}

export async function deleteUserSavedTrip(
  dependencies: DeleteUserSavedTripDependencies,
  input: DeleteUserSavedTripInput,
): Promise<void> {
  const existing = await dependencies.savedTripsRepository.findByExternalTripId(
    input.userId,
    input.externalTripId,
  );

  if (!existing) {
    throw new NotFoundError('Saved trip not found', {
      externalTripId: input.externalTripId,
    });
  }

  await dependencies.savedTripsRepository.deleteByExternalTripId(
    input.userId,
    input.externalTripId,
  );

  const cacheKey =
    dependencies.cacheKeyBuilder?.(input.userId) ?? buildSavedTripsCacheKey(input.userId);

  try {
    await dependencies.cache.delete(cacheKey);
  } catch {
    // cache deletion failure should not block the response
  }
}

