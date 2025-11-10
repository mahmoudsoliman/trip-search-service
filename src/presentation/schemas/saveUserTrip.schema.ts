import { z } from 'zod';

export const saveUserTripSchema = z.object({
  tripId: z.string().min(1),
});

export type SaveUserTripSchema = z.infer<typeof saveUserTripSchema>;

