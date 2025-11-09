import type { Trip } from '../SavedTrip';

export type TripSortOption = 'fastest' | 'cheapest';

export interface TripsSearchInput {
  origin: string;
  destination: string;
  sortBy: TripSortOption;
}

export interface TripsProvider {
  searchTrips(input: Omit<TripsSearchInput, 'sortBy'>): Promise<Trip[]>;
}

