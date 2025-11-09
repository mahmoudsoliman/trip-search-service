import type { User } from '../../domain/User';
import type { CreateUserInput, UserRepository } from '../../domain/ports/UserRepository';

export interface EnsureUserInput {
  auth0Sub: string;
  email?: string | null;
  name?: string | null;
}

export interface EnsureUserDependencies {
  userRepository: UserRepository;
}

export async function ensureUser(
  dependencies: EnsureUserDependencies,
  input: EnsureUserInput,
): Promise<User> {
  const normalizedInput = normalizeInput(input);
  const existing = await dependencies.userRepository.findByAuth0Sub(normalizedInput.auth0Sub);

  if (!existing) {
    return dependencies.userRepository.create(normalizedInput);
  }

  const updates = diffUser(existing, normalizedInput);

  if (updates) {
    return dependencies.userRepository.update(existing.id, updates);
  }

  return existing;
}

function normalizeInput(input: EnsureUserInput): CreateUserInput {
  return {
    auth0Sub: input.auth0Sub,
    email: input.email ?? null,
    name: input.name ?? null,
  };
}

function diffUser(
  existing: User,
  input: CreateUserInput,
): Partial<CreateUserInput> | null {
  const changes: Partial<CreateUserInput> = {};
  let hasChanges = false;

  if (
    input.email !== undefined &&
    (existing.email ?? null) !== (input.email ?? null)
  ) {
    changes.email = input.email ?? null;
    hasChanges = true;
  }

  if (
    input.name !== undefined &&
    (existing.name ?? null) !== (input.name ?? null)
  ) {
    changes.name = input.name ?? null;
    hasChanges = true;
  }

  return hasChanges ? changes : null;
}

