import { describe, expect, it, vi } from 'vitest';

import type { Auth0ManagementClient } from '../../../../src/domain/ports/Auth0ManagementClient';
import type { User } from '../../../../src/domain/User';
import type { UserRepository } from '../../../../src/domain/ports/UserRepository';
import { registerUser } from '../../../../src/app/use-cases/registerUser';
import { ValidationError } from '../../../../src/utils/errors';

const baseUser: User = {
  id: 'user-1',
  auth0Sub: 'auth0|user-1',
  email: 'user@example.com',
  name: 'User Example',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function createRepositoryMocks() {
  return {
    findByAuth0Sub: vi.fn<UserRepository['findByAuth0Sub']>(),
    create: vi.fn<UserRepository['create']>(),
    update: vi.fn<UserRepository['update']>(),
  };
}

describe('registerUser', () => {
  it('creates user in Auth0 and repository', async () => {
    const repository = createRepositoryMocks();
    repository.findByAuth0Sub.mockResolvedValueOnce(null);
    repository.create.mockResolvedValueOnce(baseUser);

    const createUserMock = vi.fn().mockResolvedValue({
        userId: 'auth0|user-1',
        email: 'user@example.com',
        name: 'User Example',
    });

    const auth0Client: Auth0ManagementClient = {
      createUser: createUserMock,
    };

    const user = await registerUser(
      {
        auth0ManagementClient: auth0Client,
        userRepository: repository,
      },
      {
        email: 'user@example.com',
        password: 'Password123!',
        name: 'User Example',
      },
    );

    expect(createUserMock).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'Password123!',
      name: 'User Example',
    });
    expect(repository.create).toHaveBeenCalledWith({
      auth0Sub: 'auth0|user-1',
      email: 'user@example.com',
      name: 'User Example',
    });
    expect(user).toEqual(baseUser);
  });

  it('throws when user already exists in repository', async () => {
    const repository = createRepositoryMocks();
    repository.findByAuth0Sub.mockResolvedValueOnce(baseUser);

    const auth0Client: Auth0ManagementClient = {
      createUser: vi.fn().mockResolvedValue({
        userId: 'auth0|user-1',
        email: 'user@example.com',
        name: 'User Example',
      }),
    };

    await expect(
      registerUser(
        {
          auth0ManagementClient: auth0Client,
          userRepository: repository,
        },
        {
          email: 'user@example.com',
          password: 'Password123!',
        },
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

