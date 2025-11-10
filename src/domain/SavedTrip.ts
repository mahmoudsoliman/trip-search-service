export interface SavedTripSnapshot {
  id: string;
  userId: string;
  externalTripId: string;
  origin: string;
  destination: string;
  cost: number;
  duration: number;
  type: string;
  displayName: string;
  savedAt: Date;
  fetchedAt: Date;
}

export interface Trip {
  id: string;
  origin: string;
  destination: string;
  cost: number;
  duration: number;
  type: string;
  display_name: string;
}

