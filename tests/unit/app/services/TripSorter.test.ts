import { describe, expect, it } from 'vitest';

import type { Trip } from '../../../../src/domain/SavedTrip';
import { TripSorter } from '../../../../src/app/services/TripSorter';

const baseTrips: Trip[] = [
  {
    id: 'trip-2',
    origin: 'SYD',
    destination: 'GRU',
    cost: 800,
    duration: 900,
    type: 'flight',
    display_name: 'SYD → GRU Economy',
  },
  {
    id: 'trip-3',
    origin: 'SYD',
    destination: 'GRU',
    cost: 600,
    duration: 600,
    type: 'flight',
    display_name: 'SYD → GRU Saver',
  },
  {
    id: 'trip-1',
    origin: 'SYD',
    destination: 'GRU',
    cost: 600,
    duration: 700,
    type: 'flight',
    display_name: 'SYD → GRU Flex',
  },
];

describe('TripSorter', () => {
  const sorter = new TripSorter();

  it('sorts trips by cheapest option', () => {
    const sorted = sorter.sort(baseTrips, 'cheapest');

    expect(sorted.map((trip) => trip.id)).toEqual(['trip-3', 'trip-1', 'trip-2']);
  });

  it('sorts trips by fastest option', () => {
    const sorted = sorter.sort(baseTrips, 'fastest');

    expect(sorted.map((trip) => trip.id)).toEqual(['trip-3', 'trip-1', 'trip-2']);
  });
});

