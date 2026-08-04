/**
 * Test plan section 1.6 — unit tests for `backend/schema.ts` (UT-38..UT-45).
 */
import { describe, expect, it } from "vitest";

import { bookingSchema } from "../schema.js";

function validPayload(): Record<string, unknown> {
  return {
    destination_id: "dest-1",
    hotel_id: "hotel-1",
    start_date: "2026-08-01",
    end_date: "2026-08-03",
    adults: 2,
    children: 1,
    message_to_hotel: "High floor please",
    room_types: ["ocean-view"],
    price_paid: 224,
    user_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  };
}

describe("UT-38 valid payload", () => {
  it("parses a well formed booking cleanly", () => {
    const result = bookingSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
  });
});

describe("UT-39 children omitted", () => {
  it("defaults children to 0 rather than failing", () => {
    const payload = validPayload();
    delete payload.children;
    const result = bookingSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.children).toBe(0);
    }
  });
});

describe("UT-40 user_id presence and format", () => {
  it("rejects a missing user_id", () => {
    const payload = validPayload();
    delete payload.user_id;
    const result = bookingSchema.safeParse(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["user_id"]);
    }
  });

  it("rejects a user_id that is not a UUID", () => {
    const payload = { ...validPayload(), user_id: "not-a-uuid" };
    const result = bookingSchema.safeParse(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["user_id"]);
    }
  });
});

describe("UT-41 guest counts", () => {
  it("rejects zero adults", () => {
    expect(bookingSchema.safeParse({ ...validPayload(), adults: 0 }).success).toBe(false);
  });

  it("rejects a fractional adult count", () => {
    expect(bookingSchema.safeParse({ ...validPayload(), adults: 1.5 }).success).toBe(false);
  });

  it("rejects a negative children count", () => {
    expect(bookingSchema.safeParse({ ...validPayload(), children: -1 }).success).toBe(false);
  });
});

describe("UT-42 price_paid positivity", () => {
  it("rejects a zero charge", () => {
    expect(bookingSchema.safeParse({ ...validPayload(), price_paid: 0 }).success).toBe(false);
  });

  it("rejects a negative charge", () => {
    expect(bookingSchema.safeParse({ ...validPayload(), price_paid: -100 }).success).toBe(false);
  });
});

describe("UT-43 room_types shape", () => {
  it("rejects a bare string in place of an array", () => {
    const result = bookingSchema.safeParse({ ...validPayload(), room_types: "ocean" });
    expect(result.success).toBe(false);
  });
});

describe("UT-44 unknown keys", () => {
  it("strips extra client-supplied keys rather than rejecting them", () => {
    const result = bookingSchema.safeParse({ ...validPayload(), is_admin: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).is_admin).toBeUndefined();
    }
  });
});

describe("UT-45 date fields", () => {
  it("accepts plain strings with no format or ordering check", () => {
    const result = bookingSchema.safeParse({
      ...validPayload(),
      start_date: "yesterday",
      end_date: "1",
    });
    expect(result.success).toBe(true);
  });
});
