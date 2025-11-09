import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import nock from 'nock';
import { afterEach, describe, expect, it } from 'vitest';

import { createAuth0JwtVerifier } from '../../../../src/infra/auth/auth0Jwt';
import { UnauthorizedError } from '../../../../src/utils/errors';

const issuer = 'https://auth.example.com/';
const audience = 'https://api.example.com';

afterEach(() => {
  nock.cleanAll();
});

async function setupJwks() {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  jwk.use = 'sig';
  jwk.kid = 'test-key';

  nock(issuer)
    .get('/.well-known/jwks.json')
    .reply(200, { keys: [jwk] })
    .persist();

  return { privateKey };
}

describe('createAuth0JwtVerifier', () => {
  it('verifies a valid token and extracts claims', async () => {
    const { privateKey } = await setupJwks();
    const token = await new SignJWT({
      sub: 'auth0|user',
      email: 'user@example.com',
      name: 'Example User',
      scope: 'read:all',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuedAt()
      .setAudience(audience)
      .setIssuer(issuer)
      .setExpirationTime('1h')
      .sign(privateKey);

    const verify = createAuth0JwtVerifier({ issuer, audience });
    const result = await verify(token);

    expect(result.sub).toBe('auth0|user');
    expect(result.email).toBe('user@example.com');
    expect(result.name).toBe('Example User');
    expect(result.scope).toBe('read:all');
  });

  it('throws UnauthorizedError for invalid tokens', async () => {
    const { privateKey } = await setupJwks();
    const token = await new SignJWT({ sub: 'auth0|user' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setIssuedAt()
      .setAudience('wrong-audience')
      .setIssuer(issuer)
      .setExpirationTime('1h')
      .sign(privateKey);

    const verify = createAuth0JwtVerifier({ issuer, audience });

    await expect(verify(token)).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

