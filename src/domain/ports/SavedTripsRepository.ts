import type { SavedTripSnapshot, Trip } from '../SavedTrip';

export interface SaveTripInput {
  userId: string;
  trip: Trip;
  fetchedAt?: Date;
}

export interface SavedTripsRepository {
  listByUserId(userId: string, provider?: string): Promise<SavedTripSnapshot[]>;
  upsert(input: SaveTripInput): Promise<SavedTripSnapshot>;
  deleteByExternalTripId(userId: string, externalTripId: string): Promise<void>;
  findByExternalTripId(userId: string, externalTripId: string): Promise<SavedTripSnapshot | null>;
}

