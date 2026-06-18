import type { Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { trackEvent, flush, setUserId } from "@/lib/analytics/tracker";
import { readAttributionCookie } from "./helpers";
import { startOnboardingTrial, API_URL } from "@/lib/data";

/**
 * Runs every post-signup side-effect once a session exists (autoconfirm OR
 * OTP-verified) and returns where to navigate. Caller does router.push().
 */
export async function completeSignup(
  session: Session,
  opts: {
    email: string;
    explicitRedirect: string | null;
    redirectTo: string;
    method: string;
  },
): Promise<string> {
  // Attribute the conversion to the new user BEFORE firing the event — the
  // tracker's user id is otherwise set reactively (after auth state updates),
  // which races the synchronous trackEvent below and would log signup_complete
  // with no user_id (unqueryable by user, breaks funnel attribution).
  setUserId(session.user.id);
  trackEvent("conversion.signup_complete", { method: opts.method });
  flush(); // send queued events before navigation unmounts the page

  const supabase = createSupabaseBrowserClient();
  await supabase.from("user_profiles").upsert(
    {
      id: session.user.id,
      email: session.user.email,
      full_name:
        (session.user.user_metadata?.full_name as string) ||
        opts.email.split("@")[0],
      tos_accepted_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  // Fire-and-forget welcome email
  fetch("/api/auth/welcome", { method: "POST" }).catch(() => {});

  // Fire-and-forget content-pipeline attribution forward
  const attributionCookie = readAttributionCookie();
  if (attributionCookie) {
    fetch(`${API_URL}/api/auth-hooks/on-user-created`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: session.user.id,
        cookieValue: attributionCookie,
        tierAtSignup: "free",
      }),
      keepalive: true,
    }).catch(() => {});
  }

  // Grant the reverse Pro trial at signup so the anon-capture promise
  // ("14 days of Pro") is honest regardless of whether the user finishes the
  // tour. ensureTrialStarted is idempotent; best-effort — never block signup.
  void startOnboardingTrial().catch(() => {});

  // Honor a pending purchase intent: resume checkout on /pricing, else normal.
  const hasCheckoutIntent =
    typeof window !== "undefined" &&
    !!window.sessionStorage.getItem("checkoutIntent");
  return hasCheckoutIntent && opts.explicitRedirect
    ? opts.explicitRedirect
    : opts.redirectTo;
}
