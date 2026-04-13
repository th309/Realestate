"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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
    const next = searchParams.get("next") ?? "/map";
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

    // Listen for session establishment. Works for both implicit flow
    // (tokens in hash) and PKCE (code auto-exchanged by the client).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (event: string, session: any) => {
        if (event !== "SIGNED_IN" || !session) return;

        clearTimeout(timeoutId);
        subscription.unsubscribe();

        debugLog("2_signed_in", {
          userId: session.user.id,
          email: session.user.email,
        });

        // Ensure the session is persisted in the cookie-based client
        // so RLS-authenticated queries work
        await supabase.auth.setSession({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });

        try {
          setStatus("Setting up your account...");

          // Use Promise.race with timeout to prevent hanging queries
          const withTimeout = <T,>(p: Promise<T>, ms = 5000): Promise<T> =>
            Promise.race([
              p,
              new Promise<never>((_, rej) =>
                setTimeout(() => rej(new Error("timeout")), ms),
              ),
            ]);

          await withTimeout(handlePostSignup(supabase, session, tosFromParam));

          if (type === "recovery") {
            router.replace("/account?reset=true");
            return;
          }

          // New signups → onboarding; returning users → requested page
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const profileResult: any = await withTimeout(
            supabase
              .from("user_profiles")
              .select("tos_accepted_at")
              .eq("id", session.user.id)
              .single(),
          );
          const profile = profileResult?.data;

          const isNewSignup = profile && !profile.tos_accepted_at;
          const destination = isNewSignup ? "/get-started" : next;
          debugLog("3_redirect", { to: destination, isNewSignup });
          router.replace(destination);
        } catch (err) {
          debugLog("post_signup_error", { error: String(err) });
          // Auth succeeded even if post-signup tasks failed — redirect
          router.replace(next);
        }
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

  // Welcome email (fire-and-forget)
  fetch("/api/auth/welcome", { method: "POST" }).catch(() => {});

  // Referral attribution
  const refCode = getCookie("piq_ref");
  if (refCode) {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || ""}/api/referrals/apply-code`, {
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
