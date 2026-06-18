import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key)
  throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required");

export const admin = createClient(url, key, {
  auth: { persistSession: false },
});

export async function getUserIdByEmail(email: string): Promise<string> {
  // Newest row (defensive against a stray duplicate) + short retry for the
  // post-signup trigger that creates the user_profiles row.
  for (let attempt = 0; attempt < 10; attempt++) {
    const { data, error } = await admin
      .from("user_profiles")
      .select("id, created_at")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw new Error(`query failed for ${email}: ${error.message}`);
    if (data && data.length > 0) return data[0].id;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`user not found after retries: ${email}`);
}

export async function getActiveTrial(userId: string) {
  const { data } = await admin
    .from("user_trials")
    .select("tier, started_at, expires_at, converted_at, cancelled_at")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function getUsageStats(userId: string) {
  const { data } = await admin
    .from("user_profiles")
    .select("usage_stats, onboarding_checklist")
    .eq("id", userId)
    .single();
  return data;
}

export async function emailWasLogged(
  userId: string,
  emailType: string,
): Promise<boolean> {
  const { data } = await admin
    .from("email_log")
    .select("id")
    .eq("user_id", userId)
    .eq("email_type", emailType)
    .maybeSingle();
  return !!data;
}
