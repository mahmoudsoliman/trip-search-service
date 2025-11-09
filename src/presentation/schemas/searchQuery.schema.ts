import { z } from 'zod';

const iataSchema = z
  .string()
  .trim()
  .min(3, { message: 'Must be a 3-letter IATA code' })
  .max(3, { message: 'Must be a 3-letter IATA code' })
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z]{3}$/.test(value), {
    message: 'Must be a 3-letter IATA code',
  });

export const searchQuerySchema = z.object({
  origin: iataSchema,
  destination: iataSchema,
  sort_by: z.enum(['fastest', 'cheapest']).default('cheapest'),
});

export type SearchQuerySchema = z.infer<typeof searchQuerySchema>;

