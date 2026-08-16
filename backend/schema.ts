import { z } from "zod";

export const bookingSchema = z.object({
  destination_id: z.string().meta({ example: "EzoR", description: "Ascenda destination UID" }),
  hotel_id: z.string().meta({ example: "MU74", description: "Ascenda hotel UID" }),
  start_date: z.string().meta({ example: "2026-08-24", description: "ISO date string" }),
  end_date: z.string().meta({ example: "2026-08-26", description: "ISO date string" }),
  adults: z.number().int().min(1).meta({ example: 2, description: "Number of adults" }),
  children: z.number().int().min(0).default(0).meta({ example: 0, description: "Number of children" }),
  message_to_hotel: z.string().optional().meta({ example: "Late check-in preferred" }),
  room_types: z.array(z.string()).meta({ example: ["e9e8555f-e187-5194-819a-45bfa9ca9cec"] }),
  price_paid: z.number().positive().meta({ example: 901.04, description: "Total amount in SGD" }),
  payee_id: z.string().uuid().optional(),
  payment_id: z.string().uuid().optional(),
  user_id: z.string().uuid().meta({ description: "Supabase user UUID" }),
});

export type Booking = z.infer<typeof bookingSchema>;

// ─── GET /api/hotels ─────────────────────────────────────────────────────────

export const hotelsQuerySchema = z.object({
  destination_id: z.string().regex(/^[A-Z0-9]{4,64}$/, "must be a valid Ascenda destination UID").meta({ example: "EzoR", description: "Ascenda destination UID" }),
});

export type HotelsQuery = z.infer<typeof hotelsQuerySchema>;

// ─── GET /api/hotels/prices & GET /api/hotels/:id/price ─────────────────────

export const searchQuerySchema = z.object({
  destination_id: z.string().min(1).meta({ example: "EzoR" }),
  checkin: z.string().regex(/^(0[1-9]|1[0-9]|20)[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/, "must be a valid YYYY-MM-DD date (year 0000–99 not allowed)").meta({ example: "2026-08-24", description: "ISO date string" }),
  checkout: z.string().regex(/^(0[1-9]|1[0-9]|20)[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/, "must be a valid YYYY-MM-DD date (year 0000–99 not allowed)").meta({ example: "2026-08-26", description: "ISO date string" }),
  guests: z.string().regex(/^[0-9]+$/, "must be a positive integer").meta({ example: "2", description: "Total guest count" }),
  currency: z.string().regex(/^[A-Z]{3}$/, "3-letter ISO currency code").default("SGD").meta({ example: "SGD" }),
  country_code: z.string().regex(/^[A-Z]{2}$/, "2-letter ISO country code").default("SG").meta({ example: "SG" }),
  lang: z.string().default("en_US").meta({ example: "en_US" }),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;

