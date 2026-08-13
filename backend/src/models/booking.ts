import { Hono } from "hono";
import { withSupabase } from "@supabase/server/adapters/hono";
import { bookingSchema } from "../../schema.js";
import Stripe from "stripe";

const app = new Hono();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);


app.get("/", withSupabase({ auth: "user" }), async (c) => {
  const { supabase } = c.var.supabaseContext;
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return c.json({ error: error.message }, { status: 500 });
  }

  return c.json(data);
});

app.post("/", withSupabase({ auth: "user" }), async (c) => {
  const body = await c.req.json();

  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error },
      { status: 400 }
    );
  }

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(parsed.data.price_paid * 100),
      currency: "sgd",
      automatic_payment_methods: { enabled: true },
      metadata: {
        destination_id: parsed.data.destination_id,
        hotel_id: parsed.data.hotel_id,
        start_date: parsed.data.start_date,
        end_date: parsed.data.end_date,
        adults: String(parsed.data.adults),
        children: String(parsed.data.children),
        message_to_hotel: parsed.data.message_to_hotel ?? "",
        room_types: JSON.stringify(parsed.data.room_types),
        price_paid: String(parsed.data.price_paid),
        user_id: parsed.data.user_id,
      },
    });

    return c.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment setup failed";
    return c.json({ error: message }, { status: 500 });
  }
});

export default app;
