import request from 'supertest';
import { describe, expect, it } from 'vitest';

import type { Auth0ManagementClient } from '../../src/domain/ports/Auth0ManagementClient';
import type { User } from '../../src/domain/User';
import type { UserRepository } from '../../src/domain/ports/UserRepository';
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
      },
      verifyAccessToken: () => Promise.reject(new Error('not used')),
      auth0ManagementClient: auth0Client,
      userRepository,
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

