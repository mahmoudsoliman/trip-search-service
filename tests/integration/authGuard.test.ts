import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import type { User } from '../../src/domain/User';
import type { UserRepository } from '../../src/domain/ports/UserRepository';
import type { VerifyAccessToken, VerifiedAuth0Token } from '../../src/infra/auth/auth0Jwt';
import type { Auth0ManagementClient } from '../../src/domain/ports/Auth0ManagementClient';
import { InMemoryCache } from '../../src/infra/cache/InMemoryCache';
import { buildServer } from '../../src';

class InMemoryUserRepository implements UserRepository {
  private users = new Map<string, User>();

  findByAuth0Sub(auth0Sub: string): Promise<User | null> {
    const user = [...this.users.values()].find((candidate) => candidate.auth0Sub === auth0Sub) ?? null;
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

  update(id: string, data: Partial<{ auth0Sub: string; email?: string | null; name?: string | null }>): Promise<User> {
    const existing = this.users.get(id);
    if (!existing) {
      throw new Error('User not found');
    }

    const updated: User = {
      ...existing,
      ...('email' in data ? { email: data.email ?? null } : {}),
      ...('name' in data ? { name: data.name ?? null } : {}),
      updatedAt: new Date(),
    };

    this.users.set(id, updated);
    return Promise.resolve(updated);
  }
}

describe('Auth guard', () => {
  const verifyAccessToken: VerifyAccessToken = vi
    .fn(() =>
      Promise.resolve({
        sub: 'auth0|user',
        email: 'user@example.com',
        name: 'Example User',
        payload: {},
      }),
    )
    .mockName('verifyAccessToken') as VerifyAccessToken;

  const userRepository = new InMemoryUserRepository();

  it('rejects requests without bearer token', async () => {
    const auth0ManagementClient: Auth0ManagementClient = {
      createUser: () => Promise.reject(new Error('not used')),
    };

    const app = buildServer({
      cache: new InMemoryCache(),
      tripsProvider: {
        searchTrips: () => Promise.resolve([]),
      },
      verifyAccessToken,
      userRepository,
      auth0ManagementClient,
    });
    await app.ready();

    const response = await request(app.server).get('/v1/me/profile').expect(401);
    const body = response.body as { message: string };
    expect(body.message).toBe('Missing bearer token');

    await app.close();
  });

  it('allows authenticated requests and ensures user', async () => {
    const auth0ManagementClient: Auth0ManagementClient = {
      createUser: () => Promise.reject(new Error('not used')),
    };

    const app = buildServer({
      cache: new InMemoryCache(),
      tripsProvider: {
        searchTrips: () => Promise.resolve([]),
      },
      verifyAccessToken: (() =>
        Promise.resolve({
          sub: 'auth0|user2',
          email: 'second@example.com',
          name: 'Second User',
          payload: {},
        } as VerifiedAuth0Token)) as VerifyAccessToken,
      userRepository: new InMemoryUserRepository(),
      auth0ManagementClient,
    });
    await app.ready();

    const response = await request(app.server)
      .get('/v1/me/profile')
      .set('Authorization', 'Bearer test-token')
      .expect(200);

    const body = response.body as { user: { auth0Sub: string; email: string | null } };

    expect(body.user.auth0Sub).toBe('auth0|user2');
    expect(body.user.email).toBe('second@example.com');

    await app.close();
  });
});

