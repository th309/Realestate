"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Auth callback page — handles PKCE code exchange CLIENT-SIDE.
 *
 * The PKCE code verifier is stored by the browser Supabase client
 * (in cookies/localStorage). A server-side Route Handler cannot access
 * it, causing "PKCE code verifier not found in storage" errors.
 * Moving the exchange to a client component resolves this.
 */

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
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    handleCallback();

    async function handleCallback() {
      const code = searchParams.get("code");
      const type = searchParams.get("type");
      const next = searchParams.get("next") ?? "/map";
      const tosFromParam = searchParams.get("tos") === "1";

      if (!code) {
        router.replace("/auth/sign-in?error=auth_callback_failed");
        return;
      }

      const supabase = createSupabaseBrowserClient();

      // Exchange the auth code for a session (PKCE verifier is in browser storage)
      const { data, error: exchangeError } =
        await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError || !data.user) {
        console.error(
          "[auth/callback] Code exchange failed:",
          exchangeError?.message ?? "no user returned",
        );
        setError(exchangeError?.message ?? "Authentication failed");
        router.replace("/auth/sign-in?error=auth_callback_failed");
        return;
      }

      const user = data.user;

      // --- Post-signup tasks (non-blocking) ---

      // Check if this is a first-time signup (profile has no tos_accepted_at yet)
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("id, tos_accepted_at")
        .eq("id", user.id)
        .single();

      const isNewSignup = profile && !profile.tos_accepted_at;

      // Record ToS acceptance
      const tosAccepted = tosFromParam || !!user.user_metadata?.tos_accepted_at;
      if (tosAccepted) {
        supabase
          .from("user_profiles")
          .upsert(
            { id: user.id, tos_accepted_at: new Date().toISOString() },
            { onConflict: "id" },
          )
          .then(({ error: tosErr }: { error: unknown }) => {
            if (tosErr)
              console.error("[auth/callback] Failed to record ToS:", tosErr);
          });
      }

      // Send welcome email for first-time signups
      if (isNewSignup) {
        fetch("/api/auth/welcome", { method: "POST" }).catch(() => {});
      }

      // Attribute referral (read cookie, call backend)
      if (isNewSignup) {
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
          // Clear referral cookie
          document.cookie =
            "piq_ref=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        }
      }

      // Recovery flow → account settings
      if (type === "recovery") {
        router.replace("/account?reset=true");
        return;
      }

      router.replace(next);
    }
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <p className="text-error text-sm">{error}</p>
      </div>
    );
  }

  return <CallbackSpinner />;
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
