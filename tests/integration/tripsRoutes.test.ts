import request from 'supertest';
import nock from 'nock';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { Trip } from '../../src/domain/SavedTrip';
import { buildServer } from '../../src';
import { InMemoryCache } from '../../src/infra/cache/InMemoryCache';
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

    const app = buildServer({ cache, tripsProvider: provider });
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

