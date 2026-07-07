import { z } from "zod";

export const bookingSchema = z.object({
  destination_id: z.string(),
  hotel_id: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  adults: z.number().int().min(1),
  children: z.number().int().min(0).default(0),
  message_to_hotel: z.string().optional(),
  room_types: z.array(z.string()),
  price_paid: z.number().positive(),
  payee_id: z.string().uuid().optional(),
  payment_id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
});

export type Booking = z.infer<typeof bookingSchema>;
