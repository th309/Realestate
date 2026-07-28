import type { Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  emitSignupCompleteOnce,
  type SignupMethod,
} from "@/lib/analytics/signup-conversion";
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
    method: SignupMethod;
  },
): Promise<string> {
  const supabase = createSupabaseBrowserClient();

  // Emission (including setUserId, the GA4 mirror and the flush before
  // navigation) lives in emitSignupCompleteOnce so this path and the
  // /auth/callback path cannot drift apart. It claims a once-per-user flag, so
  // a subsequent trip through the callback re-counts nothing.
  await emitSignupCompleteOnce(
    supabase,
    session.user.id,
    opts.method,
    session.user.created_at,
  );

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
