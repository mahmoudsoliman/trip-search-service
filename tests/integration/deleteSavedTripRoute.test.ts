import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import type { SavedTripSnapshot } from '../../src/domain/SavedTrip';
import type { SavedTripsRepository } from '../../src/domain/ports/SavedTripsRepository';
import type { UserRepository } from '../../src/domain/ports/UserRepository';
import type { TripsProvider } from '../../src/domain/ports/TripsProvider';
import type { VerifyAccessToken } from '../../src/infra/auth/auth0Jwt';
import type { Auth0ManagementClient } from '../../src/domain/ports/Auth0ManagementClient';
import { InMemoryCache } from '../../src/infra/cache/InMemoryCache';
import { buildServer } from '../../src';
import { buildSavedTripsCacheKey } from '../../src/app/use-cases/listUserSavedTrips';

class InMemoryUserRepository implements UserRepository {
  private users = new Map<string, { id: string; auth0Sub: string; email?: string | null; name?: string | null }>();

  findByAuth0Sub(auth0Sub: string) {
    return [...this.users.values()].find((user) => user.auth0Sub === auth0Sub) ?? null;
  }

  create(data: { auth0Sub: string; email?: string | null; name?: string | null }) {
    const user = {
      id: `user-${this.users.size + 1}`,
      auth0Sub: data.auth0Sub,
      email: data.email ?? null,
      name: data.name ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  update(id: string, data: Partial<{ auth0Sub: string; email?: string | null; name?: string | null }>) {
    const existing = this.users.get(id);
    if (!existing) {
      throw new Error('User not found');
    }

    const updated = {
      ...existing,
      ...('email' in data ? { email: data.email ?? null } : {}),
      ...('name' in data ? { name: data.name ?? null } : {}),
      updatedAt: new Date(),
    };

    this.users.set(id, updated);
    return updated;
  }
}

const savedTrip: SavedTripSnapshot = {
  id: 'saved-1',
  userId: 'user-1',
  externalTripId: 'trip-1',
  origin: 'SYD',
  destination: 'GRU',
  cost: 450,
  duration: 920,
  type: 'flight',
  displayName: 'SYD → GRU',
  savedAt: new Date(),
  fetchedAt: new Date(),
};

describe('DELETE /v1/me/saved-trips/:externalTripId', () => {
  it('deletes existing saved trip and invalidates cache', async () => {
    const findMock = vi
      .fn<SavedTripsRepository['findByExternalTripId']>()
      .mockResolvedValueOnce(savedTrip)
      .mockResolvedValueOnce(null);

    const deleteMock = vi.fn<SavedTripsRepository['deleteByExternalTripId']>().mockResolvedValue(
      undefined,
    );

    const savedTripsRepository: SavedTripsRepository = {
      listByUserId: vi.fn(),
      upsert: vi.fn(),
      deleteByExternalTripId: deleteMock,
      findByExternalTripId: findMock,
    };

    const cache = new InMemoryCache();
    await cache.set(buildSavedTripsCacheKey('user-1'), [savedTrip], 60);

    const verifyAccessToken: VerifyAccessToken = () =>
      Promise.resolve({
        sub: 'auth0|user',
        email: 'user@example.com',
        name: 'Example User',
        payload: {},
      });

    const auth0ManagementClient: Auth0ManagementClient = {
      createUser: () => Promise.reject(new Error('not used')),
    };

    const app = buildServer({
      cache,
      tripsProvider: {
        searchTrips: () => Promise.resolve([]),
        getTripById: () => Promise.resolve(null),
      } as TripsProvider,
      verifyAccessToken,
      userRepository: new InMemoryUserRepository(),
      savedTripsRepository,
      auth0ManagementClient,
    });
    await app.ready();

    await request(app.server)
      .delete('/v1/me/saved-trips/trip-1')
      .set('Authorization', 'Bearer token')
      .expect(204);

    expect(deleteMock).toHaveBeenCalledWith('user-1', 'trip-1');
    expect(await cache.get(buildSavedTripsCacheKey('user-1'))).toBeNull();

    await app.close();
  });

  it('returns 404 when saved trip missing', async () => {
    const savedTripsRepository: SavedTripsRepository = {
      listByUserId: vi.fn(),
      upsert: vi.fn(),
      deleteByExternalTripId: vi.fn(),
      findByExternalTripId: vi.fn().mockResolvedValue(null),
    };

    const cache = new InMemoryCache();

    const verifyAccessToken: VerifyAccessToken = () =>
      Promise.resolve({
        sub: 'auth0|user',
        email: 'user@example.com',
        name: 'Example User',
        payload: {},
      });

    const auth0ManagementClient: Auth0ManagementClient = {
      createUser: () => Promise.reject(new Error('not used')),
    };

    const app = buildServer({
      cache,
      tripsProvider: {
        searchTrips: () => Promise.resolve([]),
        getTripById: () => Promise.resolve(null),
      } as TripsProvider,
      verifyAccessToken,
      userRepository: new InMemoryUserRepository(),
      savedTripsRepository,
      auth0ManagementClient,
    });
    await app.ready();

    await request(app.server)
      .delete('/v1/me/saved-trips/missing')
      .set('Authorization', 'Bearer token')
      .expect(404);

    await app.close();
  });
});

