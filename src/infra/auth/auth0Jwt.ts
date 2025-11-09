import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

import { UnauthorizedError } from '../../utils/errors';

export interface Auth0JwtVerifierOptions {
  issuer: string;
  audience: string;
  clockToleranceSeconds?: number;
}

export interface VerifiedAuth0Token {
  sub: string;
  email?: string;
  name?: string;
  scope?: string;
  permissions?: string[];
  payload: JWTPayload;
}

export type VerifyAccessToken = (token: string) => Promise<VerifiedAuth0Token>;

export function createAuth0JwtVerifier(options: Auth0JwtVerifierOptions): VerifyAccessToken {
  if (!options.issuer || !options.audience) {
    throw new Error('Auth0 verifier requires issuer and audience');
  }

  const issuerUrl = ensureTrailingSlash(options.issuer);
  const jwks = createRemoteJWKSet(new URL('.well-known/jwks.json', issuerUrl));

  return async (token: string): Promise<VerifiedAuth0Token> => {
    try {
      const { payload } = await jwtVerify(token, jwks, {
        audience: options.audience,
        issuer: issuerUrl,
        clockTolerance: options.clockToleranceSeconds ?? 5,
      });

      if (!payload.sub) {
        throw new UnauthorizedError('Token payload missing subject (sub)');
      }

      return {
        sub: payload.sub,
        email: typeof payload.email === 'string' ? payload.email : undefined,
        name: typeof payload.name === 'string' ? payload.name : undefined,
        scope: typeof payload.scope === 'string' ? payload.scope : undefined,
        permissions: Array.isArray(payload.permissions)
          ? (payload.permissions as string[])
          : undefined,
        payload,
      };
    } catch (error) {
      throw new UnauthorizedError('Invalid or expired access token', {
        reason: error instanceof Error ? error.message : 'unknown',
      });
    }
  };
}

function ensureTrailingSlash(url: string): string {
  return url.endsWith('/') ? url : `${url}/`;
}

