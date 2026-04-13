"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const SUPABASE_REF = (process.env.NEXT_PUBLIC_SUPABASE_URL || "")
  .replace("https://", "")
  .split(".")[0];

const VERIFIER_COOKIE = `sb-${SUPABASE_REF}-auth-token-code-verifier`;

function debugLog(step: string, data?: unknown, error?: unknown) {
  console.log(`[auth/callback] ${step}`, data, error);
  fetch("/api/auth/debug-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      step,
      data,
      error: error ? String(error) : undefined,
    }),
  }).catch(() => {});
}

/**
 * Bridge the PKCE code verifier from cookies (set by @supabase/ssr) into
 * localStorage (where @supabase/supabase-js auth internals look for it).
 * Without this, exchangeCodeForSession fails with "PKCE code verifier
 * not found in storage" even though the cookie exists.
 */
function bridgePkceVerifier(): boolean {
  try {
    const match = document.cookie
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(VERIFIER_COOKIE + "="));

    if (!match) return false;

    const cookieValue = match.substring(match.indexOf("=") + 1);
    if (!cookieValue) return false;

    // @supabase/ssr stores cookie values as base64-{btoa(JSON.stringify(val))}.
    // @supabase/supabase-js reads localStorage values as raw strings (no JSON wrapper).
    // We must: strip prefix → base64 decode → JSON.parse to get the raw verifier.
    let rawValue = cookieValue;
    if (cookieValue.startsWith("base64-")) {
      try {
        const decoded = atob(cookieValue.slice(7)); // → JSON string e.g. '"abc123"'
        rawValue = JSON.parse(decoded); // → raw string e.g. 'abc123'
      } catch {
        rawValue = cookieValue;
      }
    }

    localStorage.setItem(VERIFIER_COOKIE, rawValue);
    return true;
  } catch {
    return false;
  }
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
  const [status, setStatus] = useState("Processing...");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    handleCallback();

    async function handleCallback() {
      const code = searchParams.get("code");
      const errorParam = searchParams.get("error");
      const errorDesc = searchParams.get("error_description");
      const type = searchParams.get("type");
      const next = searchParams.get("next") ?? "/map";
      const tosFromParam = searchParams.get("tos") === "1";

      debugLog("1_params", { hasCode: !!code, errorParam, errorDesc, type });

      // Supabase returned an error instead of a code (e.g. otp_expired)
      if (errorParam && !code) {
        debugLog("1_supabase_error", { errorParam, errorDesc });
        if (errorParam === "access_denied" && errorDesc?.includes("expired")) {
          setStatus("Verification link expired. Please sign up again.");
        } else {
          setStatus(errorDesc || "Authentication failed");
        }
        setTimeout(() => {
          router.replace("/auth/sign-in?error=auth_callback_failed");
        }, 3000);
        return;
      }

      if (!code) {
        router.replace("/auth/sign-in?error=auth_callback_failed");
        return;
      }

      // Bridge PKCE verifier from cookie → localStorage so createClient
      // (which reads localStorage) can find it. createBrowserClient from
      // @supabase/ssr uses its own cookie adapter that can't read the
      // verifier it stored — a known mismatch.
      const bridged = bridgePkceVerifier();
      debugLog("2_pkce_bridge", { bridged });

      // Use createClient (localStorage-based) for the PKCE exchange,
      // then transfer the session to the cookie-based SSR client.
      const exchangeClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { flowType: "pkce" } },
      );

      setStatus("Exchanging auth code...");
      const { data, error: exchangeError } =
        await exchangeClient.auth.exchangeCodeForSession(code);

      if (exchangeError || !data.user || !data.session) {
        debugLog(
          "3_exchange_FAILED",
          {
            msg: exchangeError?.message,
            status: exchangeError?.status,
          },
          exchangeError?.message,
        );

        setStatus("Verification failed. Please sign in with your password.");
        setTimeout(() => router.replace("/auth/sign-in"), 2000);
        return;
      }

      debugLog("3_exchange_OK", {
        userId: data.user.id,
        email: data.user.email,
      });

      // Transfer session to the SSR cookie-based client so middleware
      // and server components can see the authenticated user.
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      const user = data.user;
      setStatus("Setting up your account...");

      // Post-signup: check profile, record ToS, send welcome email
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("id, tos_accepted_at")
        .eq("id", user.id)
        .single();

      const isNewSignup = profile && !profile.tos_accepted_at;

      const tosAccepted = tosFromParam || !!user.user_metadata?.tos_accepted_at;
      if (tosAccepted) {
        await supabase
          .from("user_profiles")
          .upsert(
            { id: user.id, tos_accepted_at: new Date().toISOString() },
            { onConflict: "id" },
          );
      }

      if (isNewSignup) {
        fetch("/api/auth/welcome", { method: "POST" }).catch(() => {});

        const refCode = getCookie("piq_ref");
        if (refCode && data.session?.access_token) {
          fetch(
            `${process.env.NEXT_PUBLIC_API_URL || ""}/api/referrals/apply-code`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${data.session.access_token}`,
              },
              body: JSON.stringify({ code: refCode }),
            },
          ).catch(() => {});
          document.cookie =
            "piq_ref=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        }
      }

      if (type === "recovery") {
        router.replace("/account?reset=true");
        return;
      }

      // New signups → onboarding; returning users → requested page
      const destination = isNewSignup ? "/get-started" : next;
      debugLog("9_redirect", { to: destination, isNewSignup });
      router.replace(destination);
    }
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

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
