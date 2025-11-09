import { describe, expect, it, vi } from 'vitest';

import type { User } from '../../../../src/domain/User';
import type {
  CreateUserInput,
  UserRepository,
} from '../../../../src/domain/ports/UserRepository';
import { ensureUser } from '../../../../src/app/use-cases/ensureUser';

const baseUser: User = {
  id: 'user-1',
  auth0Sub: 'auth0|123',
  email: 'test@example.com',
  name: 'Test User',
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

describe('ensureUser', () => {
  it('creates a new user when not found', async () => {
    const repository = createRepositoryMocks();
    repository.findByAuth0Sub.mockResolvedValueOnce(null);
    repository.create.mockImplementation((input: CreateUserInput) =>
      Promise.resolve({
        ...baseUser,
        ...input,
      }),
    );

    const user = await ensureUser(
      { userRepository: repository },
      { auth0Sub: 'auth0|123', email: 'new@example.com', name: 'New User' },
    );

    expect(repository.create).toHaveBeenCalledWith({
      auth0Sub: 'auth0|123',
      email: 'new@example.com',
      name: 'New User',
    });
    expect(user.email).toBe('new@example.com');
    expect(user.name).toBe('New User');
  });

  it('returns existing user when no changes required', async () => {
    const repository = createRepositoryMocks();
    repository.findByAuth0Sub.mockResolvedValueOnce(baseUser);

    const user = await ensureUser(
      { userRepository: repository },
      { auth0Sub: 'auth0|123', email: 'test@example.com', name: 'Test User' },
    );

    expect(repository.update).not.toHaveBeenCalled();
    expect(user).toEqual(baseUser);
  });

  it('updates user when email or name changes', async () => {
    const repository = createRepositoryMocks();
    repository.findByAuth0Sub.mockResolvedValueOnce(baseUser);
    repository.update.mockImplementation((_, data) =>
      Promise.resolve({
        ...baseUser,
        ...data,
        updatedAt: new Date(),
      }),
    );

    const user = await ensureUser(
      { userRepository: repository },
      { auth0Sub: 'auth0|123', email: 'updated@example.com', name: null },
    );

    expect(repository.update).toHaveBeenCalledWith('user-1', {
      email: 'updated@example.com',
      name: null,
    });
    expect(user.email).toBe('updated@example.com');
    expect(user.name).toBeNull();
  });
});

