import { describe, expect, it, vi } from 'vitest';

import type { SavedTripSnapshot, Trip } from '../../../../src/domain/SavedTrip';
import type { SavedTripsRepository } from '../../../../src/domain/ports/SavedTripsRepository';
import type { CachePort } from '../../../../src/domain/ports/CachePort';
import type { TripsProvider } from '../../../../src/domain/ports/TripsProvider';
import { saveUserTrip, buildSavedTripsCacheKey } from '../../../../src/app/use-cases/saveUserTrip';
import { NotFoundError } from '../../../../src/utils/errors';

const baseTrip: Trip = {
  id: 'trip-1',
  origin: 'SYD',
  destination: 'GRU',
  cost: 500,
  duration: 900,
  type: 'flight',
  display_name: 'SYD → GRU',
};

const snapshot: SavedTripSnapshot = {
  id: 'saved-1',
  userId: 'user-1',
  externalTripId: 'trip-1',
  origin: 'SYD',
  destination: 'GRU',
  cost: 500,
  duration: 900,
  type: 'flight',
  displayName: 'SYD → GRU',
  savedAt: new Date(),
  fetchedAt: new Date(),
};

describe('saveUserTrip', () => {
  it('upserts saved trip and invalidates cache', async () => {
    const upsertMock = vi.fn<SavedTripsRepository['upsert']>().mockResolvedValue(snapshot);
    const savedTripsRepository: SavedTripsRepository = {
      listByUserId: vi.fn(),
      upsert: upsertMock,
      deleteByExternalTripId: vi.fn(),
      findByExternalTripId: vi.fn(),
    };

    const deleteMock = vi.fn<CachePort['delete']>().mockResolvedValue(undefined);
    const cache: CachePort = {
      get: vi.fn(),
      set: vi.fn(),
      delete: deleteMock,
    };

    const tripsProvider: TripsProvider = {
      searchTrips: vi.fn(),
      getTripById: vi.fn().mockResolvedValue(baseTrip),
    };

    const result = await saveUserTrip(
      {
        savedTripsRepository,
        cache,
        cacheKeyBuilder: buildSavedTripsCacheKey,
        tripsProvider,
      },
      {
        userId: 'user-1',
        tripId: 'trip-1',
      },
    );

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        trip: baseTrip,
      }),
    );
    expect(deleteMock).toHaveBeenCalledWith('user:user-1:savedTrips');
    expect(result).toEqual(snapshot);
  });

  it('throws NotFoundError when trip is missing', async () => {
    const savedTripsRepository: SavedTripsRepository = {
      listByUserId: vi.fn(),
      upsert: vi.fn(),
      deleteByExternalTripId: vi.fn(),
      findByExternalTripId: vi.fn(),
    };
    const cache: CachePort = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    };
    const tripsProvider: TripsProvider = {
      searchTrips: vi.fn(),
      getTripById: vi.fn().mockResolvedValue(null),
    };

    await expect(
      saveUserTrip(
        {
          savedTripsRepository,
          cache,
          tripsProvider,
        },
        {
          userId: 'user-1',
          tripId: 'missing',
        },
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('buildSavedTripsCacheKey returns expected key', () => {
    expect(buildSavedTripsCacheKey('user-123')).toBe('user:user-123:savedTrips');
  });
});

