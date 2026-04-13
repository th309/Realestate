"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

// Post to server so logs appear in Railway (client console.log is invisible)
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
      // Step 1: Read URL params
      const code = searchParams.get("code");
      const type = searchParams.get("type");
      const next = searchParams.get("next") ?? "/map";
      const tosFromParam = searchParams.get("tos") === "1";

      debugLog("1_params", {
        hasCode: !!code,
        codePrefix: code?.slice(0, 8),
        type,
        next,
        tos: tosFromParam,
        url: window.location.href,
      });

      if (!code) {
        debugLog("1_no_code", { search: window.location.search });
        setStatus("No auth code found");
        router.replace("/auth/sign-in?error=auth_callback_failed");
        return;
      }

      // Step 2: Check cookies for PKCE verifier
      const allCookies = document.cookie;
      const codeVerifierCookie = allCookies
        .split(";")
        .map((c) => c.trim())
        .find(
          (c) => c.includes("code-verifier") || c.includes("code_verifier"),
        );

      debugLog("2_cookies", {
        cookieCount: allCookies.split(";").length,
        hasCodeVerifier: !!codeVerifierCookie,
        codeVerifierPrefix: codeVerifierCookie?.slice(0, 60),
        cookieNames: allCookies
          .split(";")
          .map((c) => c.trim().split("=")[0])
          .filter(Boolean),
      });

      // Step 3: Create Supabase client
      const supabase = createSupabaseBrowserClient();
      debugLog("3_client_created");

      // Step 4: Exchange code for session
      setStatus("Exchanging auth code...");
      const { data, error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError || !data.user) {
        debugLog(
          "4_exchange_FAILED",
          {
            errorMessage: exchangeError?.message,
            errorStatus: exchangeError?.status,
            hasData: !!data,
            hasUser: !!data?.user,
          },
          exchangeError?.message,
        );
        setStatus(`Exchange failed: ${exchangeError?.message}`);
        // Don't redirect immediately — leave the error visible for debugging
        setTimeout(() => {
          router.replace("/auth/sign-in?error=auth_callback_failed");
        }, 3000);
        return;
      }

      debugLog("4_exchange_OK", {
        userId: data.user.id,
        email: data.user.email,
        hasSession: !!data.session,
      });

      const user = data.user;

      // Step 5: Post-signup tasks
      setStatus("Setting up your account...");

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("id, tos_accepted_at")
        .eq("id", user.id)
        .single();

      const isNewSignup = profile && !profile.tos_accepted_at;

      debugLog("5_profile", {
        hasProfile: !!profile,
        isNewSignup,
        tosAccepted: !!profile?.tos_accepted_at,
      });

      // ToS recording
      const tosAccepted = tosFromParam || !!user.user_metadata?.tos_accepted_at;
      if (tosAccepted) {
        const { error: tosErr } = await supabase
          .from("user_profiles")
          .upsert(
            { id: user.id, tos_accepted_at: new Date().toISOString() },
            { onConflict: "id" },
          );
        debugLog("6_tos", { recorded: !tosErr, error: tosErr?.message });
      }

      // Welcome email
      if (isNewSignup) {
        fetch("/api/auth/welcome", { method: "POST" })
          .then(() => debugLog("7_welcome_email_sent"))
          .catch((e) => debugLog("7_welcome_email_failed", null, e));
      }

      // Referral
      if (isNewSignup) {
        const refCode = getCookie("piq_ref");
        if (refCode && data.session?.access_token) {
          debugLog("8_referral", { refCode });
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

      // Recovery flow
      if (type === "recovery") {
        debugLog("9_redirect", { to: "/account?reset=true" });
        router.replace("/account?reset=true");
        return;
      }

      debugLog("9_redirect", { to: next });
      router.replace(next);
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
