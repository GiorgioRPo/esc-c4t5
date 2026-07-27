import { Hono } from "hono";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const app = new Hono();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

app.post("/", async (c) => {
  const signature = c.req.header("stripe-signature");
  const rawBody = await c.req.text();

  if (!signature) {
    return c.json({ error: "Missing stripe-signature header" }, 400);
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return c.json({ error: `Webhook signature verification failed: ${message}` }, 400);
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const meta = paymentIntent.metadata;
    console.log("payment_intent.succeeded received:", paymentIntent.id);
    const { data: existing } = await supabaseAdmin
      .from("bookings")
      .select("id")
      .eq("payment_id", paymentIntent.id)
      .maybeSingle();

    if (!existing) {
      const { error } = await supabaseAdmin.from("bookings").insert({
        destination_id: meta.destination_id,
        hotel_id: meta.hotel_id,
        start_date: meta.start_date,
        end_date: meta.end_date,
        adults: Number(meta.adults),
        children: Number(meta.children),
        message_to_hotel: meta.message_to_hotel || undefined,
        room_types: JSON.parse(meta.room_types),
        price_paid: Number(meta.price_paid),
        user_id: meta.user_id,
        payment_id: paymentIntent.id,
      });

      if (error) {
        console.error("Failed to insert booking from webhook:", error.message);
        return c.json({ error: error.message }, 500);
      }

      console.log("Booking inserted for payment:", paymentIntent.id);
    } else {
      console.log("Booking already exists for this payment, skipping insert");
    }
  }

  return c.json({ received: true }, 200);
});

export default app;