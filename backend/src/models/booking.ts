import { Hono } from "hono";
import { withSupabase } from "@supabase/server/adapters/hono";
import { bookingSchema } from "../../schema.js";

const app = new Hono();

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

  const { data, error } = await supabase
    .from("bookings")
    .insert(parsed.data)
    .select()
    .single();

  if (error) {
    return c.json({ error: error.message }, { status: 500 });
  }

  return c.json(data, { status: 201 });
});

export default app;
