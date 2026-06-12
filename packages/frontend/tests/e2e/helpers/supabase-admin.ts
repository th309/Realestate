import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for E2E assertions and cleanup.
 * NEVER import this into application code — tests only.
 */
function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;
  if (!url || !secret) {
    throw new Error(
      "E2E DB assertions need NEXT_PUBLIC_SUPABASE_URL and a service/secret key in .env.test",
    );
  }
  return createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Find an auth user by email. Returns the user id or null. */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const supabase = adminClient();
  // listUsers is paginated; for a fresh unique email the user is on page 1.
  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (error) throw error;
  const match = data.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  return match?.id ?? null;
}

/**
 * True once a signup_complete event for this user is in user_events.
 * user_events keys events by (event_category, event_action) — there is NO
 * event_name column. The app fires trackEvent("conversion.signup_complete")
 * which the ingestion layer stores as category="conversion", action="signup_complete".
 */
export async function hasSignupCompleteEvent(userId: string): Promise<boolean> {
  const supabase = adminClient();
  const { data, error } = await supabase
    .from("user_events")
    .select("id")
    .eq("user_id", userId)
    .eq("event_category", "conversion")
    .eq("event_action", "signup_complete")
    .limit(1);
  if (error) throw error;
  return !!data && data.length > 0;
}

/** Delete a test user (and cascade) by id. Best-effort. */
export async function deleteUser(userId: string): Promise<void> {
  const supabase = adminClient();
  await supabase.auth.admin.deleteUser(userId).catch(() => {});
}

/**
 * Returns a VALID 6-digit signup OTP for `email` via the admin generateLink
 * API (expects Supabase `mailer_otp_length: 6`). Re-mints for an existing
 * unconfirmed user (verified), so call it AFTER the UI signup so the returned
 * code is the current one. No inbox needed. Throws if the returned code is not
 * 6 digits, so a Supabase OTP-length config drift fails the test loudly
 * instead of silently truncating in the component.
 */
export async function getSignupOtp(
  email: string,
  password: string,
): Promise<string> {
  const supabase = adminClient();
  const { data, error } = await supabase.auth.admin.generateLink({
    type: "signup",
    email,
    password,
  });
  if (error) {
    throw new Error(`getSignupOtp(${email}) failed: ${error.message}`);
  }
  const props = data?.properties as { email_otp?: string } | undefined;
  const otp = props?.email_otp ?? null;
  if (!otp || !/^\d{6}$/.test(otp)) {
    throw new Error(
      `getSignupOtp(${email}) expected a 6-digit code but got '${otp}' — check Supabase mailer_otp_length=6`,
    );
  }
  return otp;
}
