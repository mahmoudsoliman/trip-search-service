import request from 'supertest';
import nock from 'nock';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { buildServer } from '../../src';
import { InMemoryCache } from '../../src/infra/cache/InMemoryCache';
import type { CachePort } from '../../src/domain/ports/CachePort';
import type { TripsProvider } from '../../src/domain/ports/TripsProvider';
import type { Auth0ManagementClient } from '../../src/domain/ports/Auth0ManagementClient';
import type { UserRepository } from '../../src/domain/ports/UserRepository';
import type { SavedTripsRepository, SaveTripInput } from '../../src/domain/ports/SavedTripsRepository';
import type { User } from '../../src/domain/User';
import type { SavedTripSnapshot } from '../../src/domain/SavedTrip';

class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();

  findByAuth0Sub(): Promise<User | null> {
    return Promise.resolve(null);
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

class InMemorySavedTripsRepository implements SavedTripsRepository {
  private readonly trips = new Map<string, SavedTripSnapshot>();

  listByUserId(): Promise<SavedTripSnapshot[]> {
    return Promise.resolve([...this.trips.values()]);
  }

  upsert(input: SaveTripInput): Promise<SavedTripSnapshot> {
    const key = `${input.userId}:${input.trip.id}`;
    const savedTrip: SavedTripSnapshot = {
      id: key,
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
    };
    this.trips.set(key, savedTrip);
    return Promise.resolve(savedTrip);
  }

  deleteByExternalTripId(): Promise<void> {
    return Promise.resolve();
  }

  findByExternalTripId(): Promise<SavedTripSnapshot | null> {
    return Promise.resolve(null);
  }
}

describe('System routes', () => {
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

  function buildTestServer({
    cache = new InMemoryCache(),
  }: {
    cache?: CachePort;
  } = {}) {
    const auth0ManagementClient: Auth0ManagementClient = {
      createUser: () => Promise.reject(new Error('not used')),
    };

    const tripsProvider: TripsProvider = {
      searchTrips: () => Promise.resolve([]),
      getTripById: () => Promise.resolve(null),
    };

    return buildServer({
      cache,
      userRepository: new InMemoryUserRepository(),
      savedTripsRepository: new InMemorySavedTripsRepository(),
      tripsProvider,
      auth0ManagementClient,
      verifyAccessToken: () => Promise.reject(new Error('not used')),
      tripsApiBaseUrl: baseUrl,
    });
  }

  it('responds with ok for health and ready', async () => {
    const app = buildTestServer();
    await app.ready();

    nock(baseUrl).head('/').reply(200);

    await request(app.server).get('/health').expect(200, { status: 'ok' });

    const readyResponse = await request(app.server).get('/ready').expect(200);

    const readyBody = readyResponse.body as {
      status: string;
      checks: {
        database: { status: string };
        cache: { status: string };
        tripsApi: { status: string };
      };
    };

    expect(readyBody.status).toBe('ok');
    expect(readyBody.checks.database.status).toBe('skipped');
    expect(readyBody.checks.cache.status).toBe('ok');
    expect(readyBody.checks.tripsApi.status).toBe('ok');

    await app.close();
  });

  it('returns 503 when trips API is unavailable', async () => {
    const app = buildTestServer();
    await app.ready();

    nock(baseUrl).head('/').reply(503);

    const response = await request(app.server).get('/ready').expect(503);

    const errorBody = response.body as {
      status: string;
      checks: { tripsApi: { status: string } };
    };

    expect(errorBody.status).toBe('error');
    expect(errorBody.checks.tripsApi.status).toBe('error');

    await app.close();
  });
});

