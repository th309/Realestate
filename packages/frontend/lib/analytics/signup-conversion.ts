import type { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { trackEvent, flush, setUserId, gtagEvent } from "./tracker";

export type SignupMethod = "email" | "oauth";

type BrowserClient = ReturnType<typeof createSupabaseBrowserClient>;

/**
 * Upper bound on account age for the ambiguous fallback paths below.
 *
 * NOT a repeat of the 60-second freshness window that caused the original bug.
 * That window was the PRIMARY gate, so ordinary flow latency (a real Google
 * signup measured 155s) silently suppressed every OAuth conversion. Here the
 * durable `signup_completed_at` claim is the primary mechanism and this is only
 * a blast-radius bound on the cases where the database could not tell us
 * whether the conversion already happened. 24h is far beyond any plausible
 * signup latency, so it never suppresses a real first-time conversion.
 */
const FAIL_OPEN_MAX_ACCOUNT_AGE_MS = 24 * 60 * 60 * 1000;

function isRecentAccount(accountCreatedAt: string | null | undefined): boolean {
  if (!accountCreatedAt) return false; // unknown age -> never fail open
  const created = new Date(accountCreatedAt).getTime();
  return (
    Number.isFinite(created) &&
    Date.now() - created < FAIL_OPEN_MAX_ACCOUNT_AGE_MS
  );
}

/**
 * Emit `conversion.signup_complete` exactly once per user, ever.
 *
 * THE SOLE call site for this event. Both signup paths (OTP/autoconfirm in
 * complete-signup.ts, and email-confirm/OAuth in /auth/callback) route through
 * here so the two can no longer drift apart -- that drift is why the callback
 * path was missing the setUserId() call and logged conversions with a null
 * user_id.
 *
 * Exactly-once comes from a CLAIM, not a read-then-write: the `.is(null)`
 * predicate means only the first writer's UPDATE matches a row, so concurrent
 * tabs cannot both win. A DB trigger additionally pins the column write-once,
 * so the claim cannot be cleared and replayed from the browser.
 *
 * CRITICAL constraint on the fallbacks: /auth/callback invokes this on EVERY
 * session that reaches it, which for OAuth means every sign-in, not just the
 * first. So an unconditional fail-open would duplicate-fire the conversion
 * (and its GA4 sign_up / trial_start mirrors) for arbitrary RETURNING users
 * during any period of database flakiness. Ambiguity therefore emits only for
 * accounts young enough to plausibly be signing up right now.
 *
 * @param accountCreatedAt session.user.created_at — bounds the fallbacks.
 * @returns true if the event was emitted on this call.
 */
export async function emitSignupCompleteOnce(
  supabase: BrowserClient,
  userId: string,
  method: SignupMethod,
  accountCreatedAt?: string | null,
): Promise<boolean> {
  const stamp = new Date().toISOString();

  const { data: claimed, error: claimError } = await supabase
    .from("user_profiles")
    .update({ signup_completed_at: stamp })
    .eq("id", userId)
    .is("signup_completed_at", null)
    .select("id");

  // Won the claim outright: this is the first and only emission for this user.
  if (!claimError && claimed && claimed.length > 0) {
    emitSignupComplete(userId, method, null);
    return true;
  }

  // Otherwise establish prior state before deciding anything.
  const { data: row, error: readError } = await supabase
    .from("user_profiles")
    .select("signup_completed_at")
    .eq("id", userId)
    .maybeSingle();

  // Definitive: already emitted for this user. The common path for every
  // returning OAuth sign-in.
  if (!readError && row?.signup_completed_at) return false;

  // Everything below is ambiguous, so it is gated on account age.
  if (!isRecentAccount(accountCreatedAt)) return false;

  // No profile row at all -- handle_new_user() swallows its own failures, so
  // this is reachable. Create the row carrying the marker BEFORE emitting:
  // without it the caller's own upsert (which does not set this column) would
  // insert a row with NULL and the next sign-in would re-fire the conversion.
  if (!readError && !row) {
    await supabase
      .from("user_profiles")
      .upsert({ id: userId, signup_completed_at: stamp }, { onConflict: "id" });
    emitSignupComplete(userId, method, "no_profile_row");
    return true;
  }

  // Could not read, or the row exists unclaimed but the claim did not match
  // (e.g. RLS refused the write). Emit rather than lose a genuinely new
  // signup; the age gate above bounds any duplication to fresh accounts.
  emitSignupComplete(userId, method, claimError ? "claim_error" : "read_error");
  return true;
}

/**
 * Attribute the conversion to the new user BEFORE emitting. The tracker's user
 * id is otherwise set reactively (after auth state settles), which races this
 * call and would log signup_complete with user_id null -- unqueryable by user
 * and silently broken for funnel attribution.
 */
function emitSignupComplete(
  userId: string,
  method: SignupMethod,
  claimReason: string | null,
): void {
  setUserId(userId);
  trackEvent("conversion.signup_complete", {
    method,
    // Present only on the ambiguous paths, so a duplicate-looking conversion
    // can be explained during analysis instead of guessed at.
    ...(claimReason ? { claim_fallback: claimReason } : {}),
  });
  // The internal pipeline never reaches gtag; mirror to GA4 so `sign_up` is
  // visible as a Key Event there too.
  gtagEvent("sign_up", { method });
  gtagEvent("trial_start", { tier: "pro" });
  flush(); // send before navigation unmounts the page
}
