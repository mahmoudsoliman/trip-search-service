import { describe, expect, it } from 'vitest';

import { searchQuerySchema } from '../../../src/presentation/schemas/searchQuery.schema';

describe('searchQuerySchema', () => {
  it('parses and normalises valid query parameters', () => {
    const result = searchQuerySchema.parse({
      origin: 'syd',
      destination: 'gru',
      sort_by: 'fastest',
    });

    expect(result).toEqual({
      origin: 'SYD',
      destination: 'GRU',
      sort_by: 'fastest',
    });
  });

  it('throws for invalid IATA codes', () => {
    expect(() =>
      searchQuerySchema.parse({
        origin: 'Sydney',
        destination: 'GRU',
        sort_by: 'cheapest',
      }),
    ).toThrowError(/IATA code/);
  });
});

