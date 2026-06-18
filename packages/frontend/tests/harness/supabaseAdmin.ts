import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key)
  throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required");

export const admin = createClient(url, key, {
  auth: { persistSession: false },
});

export async function getUserIdByEmail(email: string): Promise<string> {
  const { data, error } = await admin
    .from("user_profiles")
    .select("id")
    .eq("email", email)
    .single();
  if (error) throw new Error(`user not found: ${email} (${error.message})`);
  return data.id;
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
