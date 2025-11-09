import type { Trip } from '../../domain/SavedTrip';
import type { CachePort } from '../../domain/ports/CachePort';
import type { TripSortOption, TripsProvider } from '../../domain/ports/TripsProvider';
import { TripSorter } from '../services/TripSorter';

export interface SearchTripsInput {
  origin: string;
  destination: string;
  sortBy: TripSortOption;
}

export interface SearchTripsDependencies {
  cache: CachePort;
  cacheTtlSeconds: number;
  tripsProvider: TripsProvider;
  sorter?: TripSorter;
}

const CACHE_KEY_PREFIX = 'search';

export async function searchTrips(
  dependencies: SearchTripsDependencies,
  input: SearchTripsInput,
): Promise<Trip[]> {
  const origin = input.origin.toUpperCase();
  const destination = input.destination.toUpperCase();
  const cacheKey = buildCacheKey(origin, destination, input.sortBy);
  const sorter = dependencies.sorter ?? new TripSorter();

  const cachedTrips = await dependencies.cache.get<Trip[]>(cacheKey);
  if (cachedTrips) {
    return cachedTrips;
  }

  const trips = await dependencies.tripsProvider.searchTrips({ origin, destination });
  const sortedTrips = sorter.sort(trips, input.sortBy);

  try {
    await dependencies.cache.set(cacheKey, sortedTrips, dependencies.cacheTtlSeconds);
  } catch {
    // Cache failures should not block the response; they are logged at the adapter level.
  }

  return sortedTrips;
}

function buildCacheKey(origin: string, destination: string, sortBy: TripSortOption): string {
  return `${CACHE_KEY_PREFIX}:${origin}:${destination}:${sortBy}`;
}

