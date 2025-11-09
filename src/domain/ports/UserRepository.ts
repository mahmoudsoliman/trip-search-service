import type { User } from '../User';

export interface CreateUserInput {
  auth0Sub: string;
  email?: string | null;
  name?: string | null;
}

export interface UserRepository {
  findByAuth0Sub(auth0Sub: string): Promise<User | null>;
  create(data: CreateUserInput): Promise<User>;
  update(id: string, data: Partial<CreateUserInput>): Promise<User>;
}

