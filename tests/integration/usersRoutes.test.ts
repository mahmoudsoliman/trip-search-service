import request from 'supertest';
import { describe, expect, it } from 'vitest';

import type { Auth0ManagementClient } from '../../src/domain/ports/Auth0ManagementClient';
import type { User } from '../../src/domain/User';
import type { UserRepository } from '../../src/domain/ports/UserRepository';
import type { SavedTripsRepository, SaveTripInput } from '../../src/domain/ports/SavedTripsRepository';
import { buildServer } from '../../src';
import { InMemoryCache } from '../../src/infra/cache/InMemoryCache';

class InMemoryUserRepository implements UserRepository {
  private users = new Map<string, User>();

  findByAuth0Sub(auth0Sub: string): Promise<User | null> {
    const user =
      [...this.users.values()].find((candidate) => candidate.auth0Sub === auth0Sub) ?? null;
    return Promise.resolve(user);
  }

  create(data: { auth0Sub: string; email?: string | null; name?: string | null }): Promise<User> {
    const user: User = {
      id: `user-${this.users.size + 1}`,
      auth0Sub: data.auth0Sub,
      email: data.email ?? null,
      name: data.name ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    return Promise.resolve(user);
  }

  update(): Promise<User> {
    throw new Error('Not implemented');
  }
}

class NoopSavedTripsRepository implements SavedTripsRepository {
  listByUserId() {
    return Promise.resolve([]);
  }

  upsert(input: SaveTripInput) {
    return Promise.resolve({
      id: 'saved-1',
      userId: input.userId,
      externalTripId: input.trip.id,
      origin: input.trip.origin,
      destination: input.trip.destination,
      cost: input.trip.cost,
      duration: input.trip.duration,
      type: input.trip.type,
      displayName: input.trip.display_name,
      savedAt: new Date(),
      fetchedAt: new Date(),
    });
  }

  deleteByExternalTripId() {
    return Promise.resolve();
  }

  findByExternalTripId() {
    return Promise.resolve(null);
  }
}

describe('Users routes', () => {
  it('creates a user and returns persisted data', async () => {
    const auth0Client: Auth0ManagementClient = {
      createUser: () =>
        Promise.resolve({
          userId: 'auth0|generated',
          email: 'new@example.com',
          name: 'New User',
        }),
    };

    const userRepository = new InMemoryUserRepository();

    const app = buildServer({
      cache: new InMemoryCache(),
      tripsProvider: {
        searchTrips: () => Promise.resolve([]),
        getTripById: () => Promise.resolve(null),
      },
      verifyAccessToken: () => Promise.reject(new Error('not used')),
      auth0ManagementClient: auth0Client,
      userRepository,
      savedTripsRepository: new NoopSavedTripsRepository(),
    });
    await app.ready();

    const response = await request(app.server)
      .post('/v1/users')
      .send({
        email: 'new@example.com',
        password: 'StrongPassword123',
        name: 'New User',
      })
      .expect(201);

    const body = response.body as { user: { auth0Sub: string; email: string } };

    expect(body.user.auth0Sub).toBe('auth0|generated');
    expect(body.user.email).toBe('new@example.com');

    await app.close();
  });
});

