import { createSupabaseContext, type WithSupabaseConfig } from "@supabase/server";
import type { Database } from "../database.types.js";
import type { Context } from "hono";

export async function supabaseWithTypes(c: Context, supabaseConfig: WithSupabaseConfig ) {
  const { data: supabaseContext, error: authError } = await createSupabaseContext<Database>(
    c.req.raw,
    supabaseConfig
  );
  if (supabaseContext === null || authError) {
    return null;
  }

  return supabaseContext.supabase;
}
