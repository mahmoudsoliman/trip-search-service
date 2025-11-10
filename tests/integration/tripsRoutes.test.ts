import request from 'supertest';
import nock from 'nock';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { Trip } from '../../src/domain/SavedTrip';
import { buildServer } from '../../src';
import { InMemoryCache } from '../../src/infra/cache/InMemoryCache';
import type { Auth0ManagementClient } from '../../src/domain/ports/Auth0ManagementClient';
import type { User } from '../../src/domain/User';
import type { UserRepository } from '../../src/domain/ports/UserRepository';
import type { SavedTripsRepository, SaveTripInput } from '../../src/domain/ports/SavedTripsRepository';

class InMemoryUserRepository implements UserRepository {
  private users = new Map<string, User>();

  findByAuth0Sub(): Promise<User | null> {
    return Promise.resolve(null);
  }

  create(data: { auth0Sub: string; email?: string | null; name?: string | null }): Promise<User> {
    return Promise.resolve({
      id: 'user-1',
      auth0Sub: data.auth0Sub,
      email: data.email ?? null,
      name: data.name ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
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
import { TripsApiClient } from '../../src/infra/providers/TripsApiClient';

describe('Trips routes', () => {
  const baseUrl = 'https://thirdparty.test';

  beforeAll(() => {
    nock.disableNetConnect();
    nock.enableNetConnect('127.0.0.1');
  });

  afterEach(() => {
    nock.cleanAll();
  });

  afterAll(() => {
    nock.enableNetConnect();
  });

  it('returns sorted trips and caches the response', async () => {
    const provider = new TripsApiClient({
      baseUrl,
      timeoutMs: 500,
      retryAttempts: 0,
    });
    const cache = new InMemoryCache();

    const auth0ManagementClient: Auth0ManagementClient = {
      createUser: () => Promise.reject(new Error('not used')),
    };

    const app = buildServer({
      cache,
      tripsProvider: provider,
      verifyAccessToken: () => Promise.reject(new Error('not used')),
      userRepository: new InMemoryUserRepository(),
      auth0ManagementClient,
      savedTripsRepository: new NoopSavedTripsRepository(),
    });
    await app.ready();

    const externalTrips: Trip[] = [
      {
        id: 'trip-2',
        origin: 'SYD',
        destination: 'GRU',
        cost: 450,
        duration: 700,
        type: 'flight',
        display_name: 'SYD → GRU Saver',
      },
      {
        id: 'trip-1',
        origin: 'SYD',
        destination: 'GRU',
        cost: 400,
        duration: 800,
        type: 'flight',
        display_name: 'SYD → GRU Flex',
      },
    ];

    const scope = nock(baseUrl)
      .get('/default/trips')
      .query({ origin: 'SYD', destination: 'GRU' })
      .reply(200, externalTrips);

    const firstResponse = await request(app.server)
      .get('/v1/trips/search')
      .query({ origin: 'SYD', destination: 'GRU', sort_by: 'cheapest' })
      .expect(200);

    const firstBody = firstResponse.body as { trips: Trip[] };

    expect(firstBody.trips.map((trip) => trip.id)).toEqual(['trip-1', 'trip-2']);
    expect(scope.isDone()).toBe(true);

    // Second request should be served from cache, no new HTTP call expected.
    const cachedResponse = await request(app.server)
      .get('/v1/trips/search')
      .query({ origin: 'SYD', destination: 'GRU', sort_by: 'cheapest' })
      .expect(200);

    const cachedBody = cachedResponse.body as { trips: Trip[] };

    expect(cachedBody.trips).toEqual(firstBody.trips);

    await app.close();
  });
});

