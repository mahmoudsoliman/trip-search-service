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
  provider?: string | null;
  savedAt: Date;
  fetchedAt: Date;
  raw?: Record<string, unknown> | null;
}

export interface Trip {
  id: string;
  origin: string;
  destination: string;
  cost: number;
  duration: number;
  type: string;
  display_name: string;
  provider?: string;
}

