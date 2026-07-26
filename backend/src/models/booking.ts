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
  const { supabase } = c.var.supabaseContext;
  const body = await c.req.json();

  const parsed = bookingSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error },
      { status: 400 }
    );
  }

  let paymentIntent: Stripe.PaymentIntent;
  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(parsed.data.price_paid * 100),
      currency: "sgd",
      automatic_payment_methods: { enabled: true },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payment setup failed";
    return c.json({ error: message }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("bookings")
    .insert({
      ...parsed.data,
      // @ts-ignore
      payment_id: paymentIntent.id,
    })
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, { status: 500 });
  }

  return c.json(data, { status: 201 });
});

export default app;
