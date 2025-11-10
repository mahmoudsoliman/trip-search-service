import type { SavedTripSnapshot } from '../../domain/SavedTrip';

export function mapSavedTrip(savedTrip: SavedTripSnapshot) {
  return {
    id: savedTrip.id,
    userId: savedTrip.userId,
    externalTripId: savedTrip.externalTripId,
    origin: savedTrip.origin,
    destination: savedTrip.destination,
    cost: savedTrip.cost,
    duration: savedTrip.duration,
    type: savedTrip.type,
    display_name: savedTrip.displayName,
    savedAt: savedTrip.savedAt,
    fetchedAt: savedTrip.fetchedAt,
  };
}

