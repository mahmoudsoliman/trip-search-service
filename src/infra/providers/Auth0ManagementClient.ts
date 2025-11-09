import { URLSearchParams } from 'node:url';

import type {
  Auth0ManagementClient as Auth0ManagementClientPort,
  CreateAuth0UserInput,
  Auth0User,
} from '../../domain/ports/Auth0ManagementClient';
import { ApplicationError } from '../../utils/errors';

interface Auth0ManagementClientOptions {
  domain: string;
  clientId: string;
  clientSecret: string;
  audience: string;
  connection: string;
  scope?: string;
}

interface ManagementTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface Auth0CreateUserResponse {
  user_id: string;
  email: string;
  name?: string;
}

export class Auth0ManagementClient implements Auth0ManagementClientPort {
  private accessToken?: string;

  private tokenExpiresAt?: number;

  constructor(private readonly options: Auth0ManagementClientOptions) {
    if (!options.domain || !options.clientId || !options.clientSecret || !options.audience) {
      throw new Error('Auth0 management client requires domain, client credentials, and audience');
    }
  }

  async createUser(input: CreateAuth0UserInput): Promise<Auth0User> {
    const token = await this.getManagementToken();

    const response = await fetch(`${this.options.domain}api/v2/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        connection: this.options.connection,
        email: input.email,
        password: input.password,
        name: input.name,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new ApplicationError(
        `Failed to create user in Auth0: ${response.status} ${response.statusText}`,
        response.status,
        { body },
      );
    }

    const data = (await response.json()) as Auth0CreateUserResponse;

    if (!data.user_id) {
      throw new ApplicationError('Auth0 did not return a user id', 500, { data });
    }

    return {
      userId: data.user_id,
      email: data.email,
      name: data.name ?? null,
    };
  }

  private async getManagementToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.options.clientId,
      client_secret: this.options.clientSecret,
      audience: this.options.audience,
    });

    if (this.options.scope) {
      body.set('scope', this.options.scope);
    }

    const response = await fetch(`${this.options.domain}oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new ApplicationError(
        `Failed to obtain Auth0 management token: ${response.status} ${response.statusText}`,
        response.status,
        { body: text },
      );
    }

    const data = (await response.json()) as ManagementTokenResponse;
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000 - 60_000; // refresh 60s before expiry

    return this.accessToken;
  }
}

