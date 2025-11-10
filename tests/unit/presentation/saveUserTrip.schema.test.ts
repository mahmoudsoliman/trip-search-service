import { describe, expect, it } from 'vitest';

import { saveUserTripSchema } from '../../../src/presentation/schemas/saveUserTrip.schema';

describe('saveUserTripSchema', () => {
  it('parses valid payload', () => {
    const payload = {
      tripId: 'trip-1',
    };

    const parsed = saveUserTripSchema.parse(payload);
    expect(parsed).toEqual(payload);
  });

  it('rejects invalid payload', () => {
    expect(() =>
      saveUserTripSchema.parse({
        tripId: '',
      }),
    ).toThrow();
  });
});

