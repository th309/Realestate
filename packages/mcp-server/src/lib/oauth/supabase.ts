import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.warn(
    "[OAuth] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — OAuth disabled",
  );
}

export const supabase = url && key ? createClient(url, key) : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error(
      "OAuth requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  return supabase;
}
