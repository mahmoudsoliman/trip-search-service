import { describe, expect, it, vi } from 'vitest';

import type { SavedTripSnapshot } from '../../../../src/domain/SavedTrip';
import type { SavedTripsRepository } from '../../../../src/domain/ports/SavedTripsRepository';
import type { CachePort } from '../../../../src/domain/ports/CachePort';
import { listUserSavedTrips, buildSavedTripsCacheKey } from '../../../../src/app/use-cases/listUserSavedTrips';

const savedTrip: SavedTripSnapshot = {
  id: 'saved-1',
  userId: 'user-1',
  externalTripId: 'trip-1',
  origin: 'SYD',
  destination: 'GRU',
  cost: 500,
  duration: 900,
  type: 'flight',
  displayName: 'SYD → GRU',
  savedAt: new Date('2025-01-01T00:00:00.000Z'),
  fetchedAt: new Date('2025-01-01T00:10:00.000Z'),
};

describe('listUserSavedTrips', () => {
  it('returns cached trips when available', async () => {
    const listByUserIdMock = vi.fn<SavedTripsRepository['listByUserId']>();

    const repository: SavedTripsRepository = {
      listByUserId: listByUserIdMock,
      upsert: vi.fn(),
      deleteByExternalTripId: vi.fn(),
      findByExternalTripId: vi.fn(),
    };

    const cache: CachePort = {
      get: vi.fn().mockResolvedValue([
        {
          ...savedTrip,
          savedAt: savedTrip.savedAt.toISOString(),
          fetchedAt: savedTrip.fetchedAt.toISOString(),
        },
      ]),
      set: vi.fn(),
      delete: vi.fn(),
    };

    const trips = await listUserSavedTrips(
      {
        savedTripsRepository: repository,
        cache,
        cacheTtlSeconds: 60,
        cacheKeyBuilder: buildSavedTripsCacheKey,
      },
      { userId: 'user-1' },
    );

    expect(listByUserIdMock).not.toHaveBeenCalled();
    expect(trips).toHaveLength(1);
    expect(trips[0].savedAt).toEqual(savedTrip.savedAt);
  });

  it('fetches from repository and caches result when cache miss', async () => {
    const listByUserIdMock = vi.fn<SavedTripsRepository['listByUserId']>().mockResolvedValue([
      savedTrip,
    ]);

    const repository: SavedTripsRepository = {
      listByUserId: listByUserIdMock,
      upsert: vi.fn(),
      deleteByExternalTripId: vi.fn(),
      findByExternalTripId: vi.fn(),
    };

    const setMock = vi.fn<CachePort['set']>().mockResolvedValue(undefined);
    const cache: CachePort = {
      get: vi.fn().mockResolvedValue(null),
      set: setMock,
      delete: vi.fn(),
    };

    const trips = await listUserSavedTrips(
      {
        savedTripsRepository: repository,
        cache,
        cacheTtlSeconds: 60,
        cacheKeyBuilder: buildSavedTripsCacheKey,
      },
      { userId: 'user-1' },
    );

    expect(listByUserIdMock).toHaveBeenCalledWith('user-1');
    expect(setMock).toHaveBeenCalledWith(
      'user:user-1:savedTrips',
      [
        {
          ...savedTrip,
          savedAt: savedTrip.savedAt.toISOString(),
          fetchedAt: savedTrip.fetchedAt.toISOString(),
        },
      ],
      60,
    );
    expect(trips).toEqual([savedTrip]);
  });
});

