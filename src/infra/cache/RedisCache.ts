import { createClient, type RedisClientType } from 'redis';

import type { CachePort } from '../../domain/ports/CachePort';
import { logger } from '../obs/logger';

interface RedisCacheOptions {
  url: string;
}

export class RedisCache implements CachePort {
  private client: RedisClientType | null = null;

  private connectPromise?: Promise<void>;

  constructor(private readonly options: RedisCacheOptions) {
    if (!options.url) {
      throw new Error('Redis cache requires a connection URL');
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const client = await this.getClient();
    if (!client) {
      return null;
    }

    try {
      const value = await client.get(key);
      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      logger.warn({ err: error, key }, 'Failed to read from Redis cache');
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const client = await this.getClient();
    if (!client) {
      return;
    }

    try {
      const payload = JSON.stringify(value);
      await client.set(key, payload, { EX: ttlSeconds });
    } catch (error) {
      logger.warn({ err: error, key }, 'Failed to write to Redis cache');
    }
  }

  async delete(key: string): Promise<void> {
    const client = await this.getClient();
    if (!client) {
      return;
    }

    try {
      await client.del(key);
    } catch (error) {
      logger.warn({ err: error, key }, 'Failed to delete Redis cache key');
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
    }
  }

  private async getClient(): Promise<RedisClientType | null> {
    if (!this.client) {
      const client = createClient({ url: this.options.url }) as RedisClientType;
      client.on('error', (error) => {
        logger.error({ err: error }, 'Redis client error');
      });
      this.client = client;
      this.connectPromise ??= client
        .connect()
        .then(() => undefined)
        .catch((error) => {
          logger.warn({ err: error }, 'Redis connection attempt failed');
          this.client = null;
        })
        .finally(() => {
          this.connectPromise = undefined;
        });
    }

    if (this.connectPromise) {
      await this.connectPromise;
    }

    return this.client;
  }
}

