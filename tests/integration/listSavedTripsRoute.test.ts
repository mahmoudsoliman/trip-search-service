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
  cost: 400,
  duration: 900,
  type: 'flight',
  displayName: 'SYD → GRU',
  savedAt: new Date('2025-01-01T00:00:00.000Z'),
  fetchedAt: new Date('2025-01-01T00:05:00.000Z'),
};

describe('GET /v1/me/saved-trips', () => {
  it('returns saved trips and uses cache on subsequent calls', async () => {
    const listByUserIdMock = vi.fn<SavedTripsRepository['listByUserId']>().mockResolvedValue([
      savedTrip,
    ]);

    const savedTripsRepository: SavedTripsRepository = {
      listByUserId: listByUserIdMock,
      upsert: vi.fn(),
      deleteByExternalTripId: vi.fn(),
      findByExternalTripId: vi.fn(),
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

    const firstResponse = await request(app.server)
      .get('/v1/me/saved-trips')
      .set('Authorization', 'Bearer token')
      .expect(200);

    const firstBody = firstResponse.body as { savedTrips: { externalTripId: string }[] };

    expect(firstBody.savedTrips).toHaveLength(1);
    expect(firstBody.savedTrips[0].externalTripId).toBe('trip-1');
    expect(listByUserIdMock).toHaveBeenCalledTimes(1);

    listByUserIdMock.mockRejectedValueOnce(new Error('Should not be called due to cache'));

    const secondResponse = await request(app.server)
      .get('/v1/me/saved-trips')
      .set('Authorization', 'Bearer token')
      .expect(200);

    const secondBody = secondResponse.body as { savedTrips: { externalTripId: string }[] };

    expect(secondBody.savedTrips).toHaveLength(1);
    expect(listByUserIdMock).toHaveBeenCalledTimes(1);

    await app.close();
  });
});

