import type { FastifyInstance } from 'fastify';

import { registerUser } from '../../../app/use-cases/registerUser';
import type { Auth0ManagementClient } from '../../../domain/ports/Auth0ManagementClient';
import type { UserRepository } from '../../../domain/ports/UserRepository';
import { createUserSchema } from '../../../presentation/schemas/user.schema';
import { ValidationError } from '../../../utils/errors';

interface UsersRouteDependencies {
  auth0ManagementClient: Auth0ManagementClient;
  userRepository: UserRepository;
}

export function registerUsersRoutes(
  app: FastifyInstance,
  dependencies: UsersRouteDependencies,
): void {
  app.post('/v1/users', async (request, reply) => {
    const parsed = createUserSchema.safeParse(request.body);

    if (!parsed.success) {
      throw new ValidationError('Invalid user payload', { issues: parsed.error.issues });
    }

    const user = await registerUser(
      {
        auth0ManagementClient: dependencies.auth0ManagementClient,
        userRepository: dependencies.userRepository,
      },
      parsed.data,
    );

    void reply.status(201);
    return {
      user: {
        id: user.id,
        auth0Sub: user.auth0Sub,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };
  });
}

