import type { Session } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { trackEvent, flush } from "@/lib/analytics/tracker";
import { readAttributionCookie } from "./helpers";

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
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    fetch(`${apiUrl}/api/auth-hooks/on-user-created`, {
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

  // Honor a pending purchase intent: resume checkout on /pricing, else normal.
  const hasCheckoutIntent =
    typeof window !== "undefined" &&
    !!window.sessionStorage.getItem("checkoutIntent");
  return hasCheckoutIntent && opts.explicitRedirect
    ? opts.explicitRedirect
    : opts.redirectTo;
}
