import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import type { SavedTripSnapshot } from '../../src/domain/SavedTrip';
import type { SavedTripsRepository, SaveTripInput } from '../../src/domain/ports/SavedTripsRepository';
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

class InMemorySavedTripsRepository implements SavedTripsRepository {
  private savedTrips = new Map<string, SavedTripSnapshot>();

  listByUserId() {
    return [...this.savedTrips.values()];
  }

  upsert(input: SaveTripInput): Promise<SavedTripSnapshot> {
    const key = `${input.userId}:${input.trip.id}`;
    const existing = this.savedTrips.get(key);

    const savedTrip: SavedTripSnapshot = {
      id: existing?.id ?? `saved-${this.savedTrips.size + 1}`,
      userId: input.userId,
      externalTripId: input.trip.id,
      origin: input.trip.origin,
      destination: input.trip.destination,
      cost: input.trip.cost,
      duration: input.trip.duration,
      type: input.trip.type,
      displayName: input.trip.display_name,
      savedAt: new Date(),
      fetchedAt: input.fetchedAt ?? new Date(),
    };

    this.savedTrips.set(key, savedTrip);
    return Promise.resolve(savedTrip);
  }

  deleteByExternalTripId(): Promise<void> {
    return Promise.resolve();
  }

  findByExternalTripId(): Promise<SavedTripSnapshot | null> {
    return Promise.resolve(null);
  }
}

describe('POST /v1/me/saved-trips', () => {
  it('saves a trip snapshot and invalidates cache', async () => {
    const userRepository = new InMemoryUserRepository();
    const savedTripsRepository = new InMemorySavedTripsRepository();
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

    const deleteSpy = vi.spyOn(cache, 'delete');

    const getTripByIdMock = vi.fn<TripsProvider['getTripById']>().mockResolvedValue({
      id: 'trip-123',
      origin: 'SYD',
      destination: 'GRU',
      cost: 420,
      duration: 900,
      type: 'flight',
      display_name: 'SYD → GRU',
    });

    const app = buildServer({
      cache,
      tripsProvider: {
        searchTrips: () => Promise.resolve([]),
        getTripById: getTripByIdMock,
      },
      verifyAccessToken,
      userRepository,
      savedTripsRepository,
      auth0ManagementClient,
    });
    await app.ready();

    const response = await request(app.server)
      .post('/v1/me/saved-trips')
      .set('Authorization', 'Bearer token')
      .send({
        tripId: 'trip-123',
      })
      .expect(201);

    const body = response.body as { savedTrip: { externalTripId: string } };

    expect(body.savedTrip.externalTripId).toBe('trip-123');
    expect(getTripByIdMock).toHaveBeenCalledWith('trip-123');
    expect(deleteSpy).toHaveBeenCalledWith('user:user-1:savedTrips');

    await app.close();
  });
});

