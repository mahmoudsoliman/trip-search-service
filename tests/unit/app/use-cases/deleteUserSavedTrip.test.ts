import { describe, expect, it, vi } from 'vitest';

import type { SavedTripsRepository } from '../../../../src/domain/ports/SavedTripsRepository';
import type { CachePort } from '../../../../src/domain/ports/CachePort';
import { deleteUserSavedTrip } from '../../../../src/app/use-cases/deleteUserSavedTrip';
import { NotFoundError } from '../../../../src/utils/errors';
import { buildSavedTripsCacheKey } from '../../../../src/app/use-cases/listUserSavedTrips';

describe('deleteUserSavedTrip', () => {
  it('deletes saved trip and invalidates cache', async () => {
    const findMock = vi.fn<SavedTripsRepository['findByExternalTripId']>().mockResolvedValue({
      id: 'saved-1',
      userId: 'user-1',
      externalTripId: 'trip-1',
      origin: 'SYD',
      destination: 'GRU',
      cost: 400,
      duration: 800,
      type: 'flight',
      displayName: 'SYD → GRU',
      savedAt: new Date(),
      fetchedAt: new Date(),
    });

    const deleteMock = vi.fn<SavedTripsRepository['deleteByExternalTripId']>().mockResolvedValue(
      undefined,
    );

    const savedTripsRepository: SavedTripsRepository = {
      listByUserId: vi.fn(),
      upsert: vi.fn(),
      deleteByExternalTripId: deleteMock,
      findByExternalTripId: findMock,
    };

    const cacheDeleteMock = vi.fn<CachePort['delete']>().mockResolvedValue(undefined);
    const cache: CachePort = {
      get: vi.fn(),
      set: vi.fn(),
      delete: cacheDeleteMock,
    };

    await deleteUserSavedTrip(
      {
        savedTripsRepository,
        cache,
        cacheKeyBuilder: buildSavedTripsCacheKey,
      },
      {
        userId: 'user-1',
        externalTripId: 'trip-1',
      },
    );

    expect(findMock).toHaveBeenCalledWith('user-1', 'trip-1');
    expect(deleteMock).toHaveBeenCalledWith('user-1', 'trip-1');
    expect(cacheDeleteMock).toHaveBeenCalledWith('user:user-1:savedTrips');
  });

  it('throws NotFoundError when saved trip does not exist', async () => {
    const savedTripsRepository: SavedTripsRepository = {
      listByUserId: vi.fn(),
      upsert: vi.fn(),
      deleteByExternalTripId: vi.fn(),
      findByExternalTripId: vi.fn().mockResolvedValue(null),
    };

    const cache: CachePort = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
    };

    await expect(
      deleteUserSavedTrip(
        {
          savedTripsRepository,
          cache,
        },
        {
          userId: 'user-1',
          externalTripId: 'missing',
        },
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

