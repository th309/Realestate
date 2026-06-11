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

/** True once a signup_complete event for this user is in user_events. */
export async function hasSignupCompleteEvent(userId: string): Promise<boolean> {
  const supabase = adminClient();
  const { data, error } = await supabase
    .from("user_events")
    .select("id")
    .eq("user_id", userId)
    .eq("event_name", "signup_complete")
    .limit(1);
  if (error) throw error;
  return !!data && data.length > 0;
}

/** Delete a test user (and cascade) by id. Best-effort. */
export async function deleteUser(userId: string): Promise<void> {
  const supabase = adminClient();
  await supabase.auth.admin.deleteUser(userId).catch(() => {});
}
