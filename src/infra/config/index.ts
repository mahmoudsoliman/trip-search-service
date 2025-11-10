import 'dotenv/config';

import { z } from 'zod';

const configSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z.string().optional(),
    TRIPS_API_BASE_URL: z.string().url().optional(),
    TRIPS_API_KEY: z.string().optional(),
    AUTH0_ISSUER: z.string().url().optional(),
    AUTH0_AUDIENCE: z.string().optional(),
    AUTH0_MGMT_CLIENT_ID: z.string().optional(),
    AUTH0_MGMT_CLIENT_SECRET: z.string().optional(),
    AUTH0_MGMT_AUDIENCE: z.string().optional(),
    AUTH0_MGMT_SCOPES: z.string().optional(),
    AUTH0_CONNECTION: z.string().default('Username-Password-Authentication'),
    DATABASE_URL: z.string().default('file:./dev.db'),
    REDIS_URL: z.string().optional(),
    CACHE_TTL_SEARCH_SECONDS: z.coerce.number().int().nonnegative().default(120),
    CACHE_TTL_SAVED_TRIPS_SECONDS: z.coerce.number().int().nonnegative().default(60),
    REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(2500),
    RETRY_ATTEMPTS: z.coerce.number().int().nonnegative().default(3)
  })
  .transform((value) => ({
    ...value,
    LOG_LEVEL: value.LOG_LEVEL ?? (value.NODE_ENV === 'development' ? 'debug' : 'info')
  }));

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    `Configuration validation failed: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`,
  );
}

export const config = parsed.data;

