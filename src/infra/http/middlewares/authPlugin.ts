import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';

import { ensureUser } from '../../../app/use-cases/ensureUser';
import type { User } from '../../../domain/User';
import type { UserRepository } from '../../../domain/ports/UserRepository';
import { UnauthorizedError } from '../../../utils/errors';
import type { VerifyAccessToken, VerifiedAuth0Token } from '../../auth/auth0Jwt';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }

  interface FastifyRequest {
    authToken?: VerifiedAuth0Token;
    currentUser?: User;
  }
}

interface AuthPluginOptions {
  verifyAccessToken: VerifyAccessToken;
  userRepository: UserRepository;
}

export const authPlugin = fp(
  (app: FastifyInstance, options: AuthPluginOptions) => {
    app.decorate('authenticate', async (request: FastifyRequest, _reply: FastifyReply) => {
      const token = extractBearerToken(request);
      if (!token) {
        throw new UnauthorizedError('Missing bearer token');
      }

      const verified = await options.verifyAccessToken(token);
      request.authToken = verified;

      const user = await ensureUser(
        { userRepository: options.userRepository },
        {
          auth0Sub: verified.sub,
          email: verified.email ?? null,
          name: verified.name ?? null,
        },
      );

      request.currentUser = user;
    });
  },
  {
    name: 'auth-plugin',
  },
);

function extractBearerToken(request: FastifyRequest): string | null {
  const authorization = request.headers.authorization;
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
    return null;
  }

  return token;
}

