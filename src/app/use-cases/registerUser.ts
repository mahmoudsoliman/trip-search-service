import type { Auth0ManagementClient } from '../../domain/ports/Auth0ManagementClient';
import type { User } from '../../domain/User';
import type { UserRepository } from '../../domain/ports/UserRepository';
import { ValidationError } from '../../utils/errors';

export interface RegisterUserInput {
  email: string;
  password: string;
  name?: string | null;
}

export interface RegisterUserDependencies {
  auth0ManagementClient: Auth0ManagementClient;
  userRepository: UserRepository;
}

export async function registerUser(
  dependencies: RegisterUserDependencies,
  input: RegisterUserInput,
): Promise<User> {
  const normalizedInput = normalizeInput(input);

  const auth0User = await dependencies.auth0ManagementClient.createUser({
    email: normalizedInput.email,
    password: normalizedInput.password,
    name: normalizedInput.name,
  });

  const existing = await dependencies.userRepository.findByAuth0Sub(auth0User.userId);
  if (existing) {
    throw new ValidationError('User already exists', { auth0Sub: auth0User.userId });
  }

  return dependencies.userRepository.create({
    auth0Sub: auth0User.userId,
    email: auth0User.email,
    name: auth0User.name ?? null,
  });
}

function normalizeInput(input: RegisterUserInput): RegisterUserInput {
  return {
    email: input.email.trim().toLowerCase(),
    password: input.password,
    name: input.name?.trim() ?? null,
  };
}

