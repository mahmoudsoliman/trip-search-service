import { z } from 'zod';

import { ALLOWED_AIRPORT_CODES, ALLOWED_AIRPORT_CODE_SET } from '../constants/airports';

const iataSchema = z
  .string()
  .trim()
  .min(3, { message: 'Must be a 3-letter IATA code' })
  .max(3, { message: 'Must be a 3-letter IATA code' })
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z]{3}$/.test(value), {
    message: 'Must be a 3-letter IATA code',
  })
  .refine((value) => ALLOWED_AIRPORT_CODE_SET.has(value), {
    message: 'Airport code is not supported',
  });

export const searchQuerySchema = z
  .object({
    origin: iataSchema,
    destination: iataSchema,
    sort_by: z.enum(['fastest', 'cheapest']).default('cheapest'),
  })
  .superRefine((value, ctx) => {
    if (value.origin === value.destination) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['destination'],
        message: 'Destination must be different from origin',
      });
    }
  });

export type SearchQuerySchema = z.infer<typeof searchQuerySchema>;

