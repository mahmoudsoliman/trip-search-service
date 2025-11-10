import type { PrismaClient, UserSavedTrip } from '@prisma/client';

import type { SavedTripSnapshot } from '../../domain/SavedTrip';
import type {
  SaveTripInput,
  SavedTripsRepository,
} from '../../domain/ports/SavedTripsRepository';

function mapToDomain(savedTrip: UserSavedTrip): SavedTripSnapshot {
  return {
    id: savedTrip.id,
    userId: savedTrip.userId,
    externalTripId: savedTrip.externalTripId,
    origin: savedTrip.origin,
    destination: savedTrip.destination,
    cost: savedTrip.cost,
    duration: savedTrip.duration,
    type: savedTrip.type,
    displayName: savedTrip.displayName,
    savedAt: savedTrip.savedAt,
    fetchedAt: savedTrip.fetchedAt,
  };
}

export class PrismaSavedTripsRepository implements SavedTripsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listByUserId(userId: string): Promise<SavedTripSnapshot[]> {
    const trips = await this.prisma.userSavedTrip.findMany({
      where: {
        userId,
      },
      orderBy: {
        savedAt: 'desc',
      },
    });

    return trips.map(mapToDomain);
  }

  async upsert(input: SaveTripInput): Promise<SavedTripSnapshot> {
    const trip = await this.prisma.userSavedTrip.upsert({
      where: {
        uniq_user_trip: {
          userId: input.userId,
          externalTripId: input.trip.id,
        },
      },
      create: {
        userId: input.userId,
        externalTripId: input.trip.id,
        origin: input.trip.origin,
        destination: input.trip.destination,
        cost: input.trip.cost,
        duration: input.trip.duration,
        type: input.trip.type,
        displayName: input.trip.display_name,
        fetchedAt: input.fetchedAt ?? new Date(),
      },
      update: {
        origin: input.trip.origin,
        destination: input.trip.destination,
        cost: input.trip.cost,
        duration: input.trip.duration,
        type: input.trip.type,
        displayName: input.trip.display_name,
        fetchedAt: input.fetchedAt ?? new Date(),
        savedAt: new Date(),
      },
    });

    return mapToDomain(trip);
  }

  async deleteByExternalTripId(userId: string, externalTripId: string): Promise<void> {
    await this.prisma.userSavedTrip.delete({
      where: {
        uniq_user_trip: {
          userId,
          externalTripId,
        },
      },
    });
  }

  async findByExternalTripId(
    userId: string,
    externalTripId: string,
  ): Promise<SavedTripSnapshot | null> {
    const trip = await this.prisma.userSavedTrip.findUnique({
      where: {
        uniq_user_trip: {
          userId,
          externalTripId,
        },
      },
    });

    return trip ? mapToDomain(trip) : null;
  }
}

