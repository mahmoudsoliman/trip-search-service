import type { PrismaClient } from '@prisma/client';

import type { User } from '../../domain/User';
import type {
  CreateUserInput,
  UserRepository,
} from '../../domain/ports/UserRepository';

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByAuth0Sub(auth0Sub: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { auth0Sub },
    });

    return user;
  }

  async create(data: CreateUserInput): Promise<User> {
    const user = await this.prisma.user.create({
      data: {
        auth0Sub: data.auth0Sub,
        email: data.email ?? null,
        name: data.name ?? null,
      },
    });

    return user;
  }

  async update(id: string, data: Partial<CreateUserInput>): Promise<User> {
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(data.email !== undefined ? { email: data.email ?? null } : {}),
        ...(data.name !== undefined ? { name: data.name ?? null } : {}),
      },
    });

    return user;
  }
}

