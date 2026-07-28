"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { emitSignupCompleteOnce } from "@/lib/analytics/signup-conversion";
import { startOnboardingTrial, API_URL } from "@/lib/data";
import { decideNeedsOnboarding } from "./onboarding-routing";

/**
 * Auth callback page — handles session establishment after email
 * verification, OAuth, and password recovery redirects.
 *
 * With implicit flow, Supabase redirects here with tokens in the URL
 * hash (#access_token=...&refresh_token=...). The browser Supabase
 * client auto-detects them via onAuthStateChange and establishes the
 * session. No PKCE code exchange needed.
 */

function debugLog(step: string, data?: unknown) {
  console.log(`[auth/callback] ${step}`, data);
  fetch("/api/auth/debug-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ step, data }),
  }).catch(() => {});
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<CallbackSpinner />}>
      <CallbackHandler />
    </Suspense>
  );
}

function CallbackSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="flex items-center gap-3 text-on-surface-variant">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Completing sign-in...</span>
      </div>
    </div>
  );
}

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Completing sign-in...");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const type = searchParams.get("type");
    const explicitNext = searchParams.get("next");
    const next = explicitNext ?? "/map";
    const tosFromParam = searchParams.get("tos") === "1";
    const errorParam = searchParams.get("error");
    const errorDesc = searchParams.get("error_description");

    debugLog("1_params", {
      type,
      next,
      hasHash: window.location.hash.length > 1,
      errorParam,
    });

    // Supabase error (e.g. otp_expired)
    if (errorParam) {
      const msg = errorDesc?.includes("expired")
        ? "Verification link expired. Please sign up again."
        : errorDesc || "Authentication failed";
      setStatus(msg);
      setTimeout(() => router.replace("/auth/sign-in"), 3000);
      return;
    }

    const supabase = createSupabaseBrowserClient();
    let timeoutId: ReturnType<typeof setTimeout>;

    // Runs AFTER the onAuthStateChange callback returns (deferred via
    // setTimeout below). CRITICAL: Supabase fires onAuthStateChange while
    // holding its auth lock. Awaiting setSession() — or any lock-acquiring
    // auth method, including .from() queries — synchronously inside that
    // callback re-enters the non-reentrant serializingAuthLock
    // (lib/supabase/client.ts) and deadlocks: the await never resolves and
    // the page hangs forever on "Completing sign-in...". Deferring this work
    // off the callback stack lets the lock release first.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const completeSignIn = async (session: any) => {
      try {
        // Ensure the session is persisted in the cookie-based client
        // so RLS-authenticated queries work
        await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });

        // Use Promise.race with timeout to prevent hanging queries
        const withTimeout = <T,>(p: Promise<T>, ms = 5000): Promise<T> =>
          Promise.race([
            p,
            new Promise<never>((_, rej) =>
              setTimeout(() => rej(new Error("timeout")), ms),
            ),
          ]);

        // Record the conversion FIRST, ahead of all the post-signup work below.
        // This used to live at the END of completeSignIn, behind a profile
        // upsert, an identity lookup and an un-timed tour-claim fetch. Two ways
        // that dropped the event: any of them throwing jumped to the outer
        // catch, and their combined latency pushed past the old 60-second
        // "isFreshSignup" window -- a real Google signup measured 155s, which
        // is why method='oauth' never once fired. Nothing here may depend on
        // that later work completing.
        //
        // `type=signup` is the emailed confirm link; `type=recovery` is a
        // password reset and is NOT a signup. Everything else reaching this
        // page with a session is OAuth.
        if (type !== "recovery") {
          try {
            // Timed like every other await here: this now runs BEFORE the user
            // is routed onward, so a hung claim must never strand them on
            // "Completing sign-in...". Losing the event beats blocking auth.
            await withTimeout(
              emitSignupCompleteOnce(
                supabase,
                session.user.id,
                type === "signup" ? "email" : "oauth",
                session.user.created_at,
              ),
            );
          } catch (err) {
            // Analytics must never break auth.
            debugLog("signup_complete_failed", { error: String(err) });
          }
        }

        setStatus("Setting up your account...");

        await withTimeout(handlePostSignup(supabase, session, tosFromParam));

        if (type === "recovery") {
          router.replace("/account?reset=true");
          return;
        }

        // Detect a freshly-linked OAuth identity on a pre-existing (email)
        // account so the destination page can show a one-time toast. Safe
        // here: completeSignIn runs off the onAuthStateChange callback, so
        // getUserIdentities does not re-enter the auth lock. Best-effort —
        // failure/timeout simply shows no toast and never blocks auth.
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const identityResult: any = await withTimeout(
            supabase.auth.getUserIdentities(),
          );
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const identities: any[] = identityResult?.data?.identities ?? [];
          const oauthIdentity = identities.find((i) => i.provider !== "email");
          const hasPassword = identities.some((i) => i.provider === "email");
          const linkedAtMs = oauthIdentity?.created_at
            ? new Date(oauthIdentity.created_at).getTime()
            : null;
          const justLinked =
            hasPassword &&
            !!oauthIdentity &&
            linkedAtMs !== null &&
            Date.now() - linkedAtMs < 60_000;
          if (justLinked) {
            sessionStorage.setItem(
              "piq_account_linked",
              oauthIdentity.provider,
            );
            debugLog("account_linked", { provider: oauthIdentity.provider });
          }
        } catch (err) {
          debugLog("account_link_check_failed", { error: String(err) });
        }

        // Reuse a tour session if the user signed up via the inline form
        // before confirming their email. The piq_tour_session cookie
        // carries the sessionId. Best-effort — failure logs but does not
        // break the callback.
        let claimedReportId: string | null = null;
        let claimedTourSessionId: string | null = null;
        const tourSessionId = getCookie("piq_tour_session");
        if (tourSessionId) {
          try {
            // Timed like every other await here: this call hits a Railway
            // backend that can cold-start, and it was previously unbounded --
            // a major contributor to the multi-minute callbacks that dropped
            // the signup conversion.
            const claimRes = await withTimeout(
              fetch(`${API_URL}/api/anonymous/claim`, {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                  Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ tourSessionId }),
              }),
            );
            if (claimRes.ok) {
              const body = (await claimRes.json()) as {
                claimed?: boolean;
                reportId?: string | null;
              };
              if (body.claimed && body.reportId) {
                claimedReportId = body.reportId;
                claimedTourSessionId = tourSessionId;
                debugLog("tour_claim", {
                  tourSessionId,
                  reportId: claimedReportId,
                });
              }
            }
          } catch (err) {
            debugLog("tour_claim_failed", { error: String(err) });
          }
        }

        // Decide where to send the user. Two independent signals:
        //  - needsOnboarding: deterministic — has the user picked an
        //    onboarding_market yet? Robust to email-confirmation delays
        //    that the old "profile age < 60s" window failed.
        //  - isFreshSignup: only used to fire the conversion analytics
        //    event once, near profile creation.
        let needsOnboarding = false;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const profileResult: any = await withTimeout(
            supabase
              .from("user_profiles")
              .select("onboarding_completed_at")
              .eq("id", session.user.id)
              .maybeSingle(),
          );
          const profile = profileResult?.data;
          needsOnboarding = decideNeedsOnboarding({
            accountCreatedAt: session.user.created_at,
            type,
            onboardingCompletedAt: profile?.onboarding_completed_at ?? null,
            now: Date.now(),
          });
          // NOTE: signup_complete is emitted near the top of completeSignIn,
          // before this query. It must not move back down here -- being behind
          // these awaits is exactly what suppressed method='oauth' entirely.
        } catch (err) {
          // Routing must never break auth. Fall back to the default
          // destination and continue.
          console.error("Onboarding routing check failed", err);
        }

        // Tour claim takes priority over the generic onboarding redirect:
        // a successful claim means the user just generated a report and
        // should land on the celebrate screen with their saved report.
        // Anyone else without an onboarding_market goes through /tour so
        // the persona+market picker → spotlight tour fires.
        const destination = claimedTourSessionId
          ? `/tour?phase=celebrate&sessionId=${encodeURIComponent(claimedTourSessionId)}`
          : needsOnboarding
            ? explicitNext
              ? `/tour?next=${encodeURIComponent(explicitNext)}`
              : "/tour"
            : next;
        debugLog("3_redirect", { to: destination, needsOnboarding });
        router.replace(destination);
      } catch (err) {
        debugLog("post_signup_error", { error: String(err) });
        // Auth succeeded even if post-signup tasks failed — redirect
        router.replace(next);
      }
    };

    // Listen for session establishment. Works for both implicit flow
    // (tokens in hash) and PKCE (code auto-exchanged by the client).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (event: string, session: any) => {
        if (event !== "SIGNED_IN" || !session) return;

        clearTimeout(timeoutId);
        subscription.unsubscribe();

        debugLog("2_signed_in", {
          userId: session.user.id,
          email: session.user.email,
        });

        // Defer the session work OUT of this callback. Supabase fires this
        // handler while holding the auth lock; doing lock-acquiring auth work
        // here would deadlock (see completeSignIn). setTimeout(0) runs it on
        // the next macrotask, after the lock has been released.
        setTimeout(() => void completeSignIn(session), 0);
      },
    );

    timeoutId = setTimeout(() => {
      subscription.unsubscribe();
      debugLog("timeout", { msg: "No session after 15s" });
      setStatus("Could not verify. Please sign in.");
      setTimeout(() => router.replace("/auth/sign-in"), 2000);
    }, 15000);

    return () => {
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface">
      <div className="flex flex-col items-center gap-3 text-on-surface-variant">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>{status}</span>
      </div>
    </div>
  );
}

async function handlePostSignup(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  session: {
    user: { id: string; user_metadata?: Record<string, unknown> };
    access_token: string;
  },
  tosFromParam: boolean,
) {
  const user = session.user;

  // Record ToS acceptance
  const tosAccepted = tosFromParam || !!user.user_metadata?.tos_accepted_at;
  if (tosAccepted) {
    await supabase
      .from("user_profiles")
      .upsert(
        { id: user.id, tos_accepted_at: new Date().toISOString() },
        { onConflict: "id" },
      );
  }

  // Reverse Pro trial for OAuth / email-confirm signups (idempotent, best-effort).
  void startOnboardingTrial().catch(() => {});

  // Welcome email (fire-and-forget)
  fetch("/api/auth/welcome", { method: "POST" }).catch(() => {});

  // Referral attribution
  const refCode = getCookie("piq_ref");
  if (refCode) {
    fetch(`${API_URL}/api/referrals/apply-code`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ code: refCode }),
    }).catch(() => {});
    document.cookie = "piq_ref=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  }
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
