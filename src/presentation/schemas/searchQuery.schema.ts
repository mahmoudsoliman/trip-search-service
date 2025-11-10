import { z } from 'zod';

const ALLOWED_IATA_CODES = new Set([
  'ATL',
  'PEK',
  'LAX',
  'DXB',
  'HND',
  'ORD',
  'LHR',
  'PVG',
  'CDG',
  'DFW',
  'AMS',
  'FRA',
  'IST',
  'CAN',
  'JFK',
  'SIN',
  'DEN',
  'ICN',
  'BKK',
  'SFO',
  'LAS',
  'CLT',
  'MIA',
  'KUL',
  'SEA',
  'MUC',
  'EWR',
  'MAD',
  'HKG',
  'MCO',
  'PHX',
  'IAH',
  'SYD',
  'MEL',
  'GRU',
  'YYZ',
  'LGW',
  'BCN',
  'MAN',
  'BOM',
  'DEL',
  'ZRH',
  'SVO',
  'DME',
  'JNB',
  'ARN',
  'OSL',
  'CPH',
  'HEL',
  'VIE',
]);

const iataSchema = z
  .string()
  .trim()
  .min(3, { message: 'Must be a 3-letter IATA code' })
  .max(3, { message: 'Must be a 3-letter IATA code' })
  .transform((value) => value.toUpperCase())
  .refine((value) => /^[A-Z]{3}$/.test(value), {
    message: 'Must be a 3-letter IATA code',
  })
  .refine((value) => ALLOWED_IATA_CODES.has(value), {
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

