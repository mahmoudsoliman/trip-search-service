export interface CreateAuth0UserInput {
  email: string;
  password: string;
  name?: string | null;
}

export interface Auth0User {
  userId: string;
  email: string;
  name?: string | null;
}

export interface Auth0ManagementClient {
  createUser(input: CreateAuth0UserInput): Promise<Auth0User>;
}

