import type { Trip } from '../../domain/SavedTrip';
import type { TripSortOption } from '../../domain/ports/TripsProvider';

export class TripSorter {
  sort(trips: Trip[], sortBy: TripSortOption): Trip[] {
    const comparator =
      sortBy === 'fastest'
        ? createComparator(['duration', 'cost', 'id'])
        : createComparator(['cost', 'duration', 'id']);

    return [...trips].sort(comparator);
  }
}

type ComparableFields = ['duration', 'cost', 'id'] | ['cost', 'duration', 'id'];

function createComparator(fields: ComparableFields) {
  return (a: Trip, b: Trip): number => {
    for (const field of fields) {
      let difference = 0;

      if (field === 'id') {
        difference = a.id.localeCompare(b.id);
      } else if (field === 'cost') {
        difference = a.cost - b.cost;
      } else {
        difference = a.duration - b.duration;
      }

      if (difference !== 0) {
        return difference;
      }
    }

    return 0;
  };
}

