import type { CachePort } from '../../domain/ports/CachePort';

interface CacheEntry {
  value: unknown;
  expiresAt: number | null;
}

export class InMemoryCache implements CachePort {
  private store = new Map<string, CacheEntry>();

  get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return Promise.resolve(null);
    }

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return Promise.resolve(null);
    }

    return Promise.resolve(entry.value as T);
  }

  set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const expiresAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null;
    this.store.set(key, { value, expiresAt });
    return Promise.resolve();
  }

  delete(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }

  disconnect(): Promise<void> {
    this.store.clear();
    return Promise.resolve();
  }
}

