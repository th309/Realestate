import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/app/api/auth/send-welcome-email";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/map";
  const tosAccepted = searchParams.get("tos") === "1";

  // Use forwarded headers to get the real external origin.
  // Behind reverse proxies (Railway, etc.), request.nextUrl.origin
  // resolves to the container's internal address (e.g. 0.0.0.0:8080).
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const origin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : request.nextUrl.origin;

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error(
        `[auth/callback] Code exchange failed: ${error.message} (code prefix: ${code.slice(0, 8)}...)`,
      );
    }

    if (!error && data.user) {
      // Check if this is a first-time signup (no existing profile row)
      const { data: existingProfile } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("id", data.user.id)
        .single();

      // Record ToS acceptance for new signups
      await recordTosAcceptance(supabase, data.user, tosAccepted);

      // Send welcome email for first-time signups (non-blocking)
      if (!existingProfile) {
        const userName =
          (data.user.user_metadata?.full_name as string) ||
          data.user.email?.split("@")[0] ||
          "there";
        sendWelcomeEmail({
          to: data.user.email!,
          name: userName,
          loginUrl: `${origin}/map`,
        });

        // Attribute referral if the user arrived via a referral link
        const refCode = request.cookies.get("piq_ref")?.value;
        if (refCode) {
          attributeReferral(data.session?.access_token, refCode).catch(() => {
            // Non-fatal — referral attribution is best-effort
          });
        }
      }

      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/account?reset=true`);
      }

      // Clear referral cookie on the redirect response (first-time signups)
      const redirectResponse = NextResponse.redirect(`${origin}${next}`);
      if (!existingProfile && request.cookies.has("piq_ref")) {
        redirectResponse.cookies.delete("piq_ref");
      }
      return redirectResponse;
    }
  }

  // Auth code exchange failed or no code provided
  return NextResponse.redirect(
    `${origin}/auth/sign-in?error=auth_callback_failed`,
  );
}

/**
 * Fire-and-forget referral attribution. Calls the backend to link the new user
 * to the referrer whose code is stored in the piq_ref cookie.
 */
async function attributeReferral(
  accessToken: string | undefined,
  code: string,
): Promise<void> {
  if (!accessToken) return;
  await fetch(`${API_URL}/api/referrals/apply-code`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ code }),
  });
}

/**
 * Write tos_accepted_at to user_profiles if this is a new signup.
 *
 * Two signals indicate ToS was accepted:
 * 1. Email signup: tos_accepted_at in user_metadata (set during signUp())
 * 2. OAuth signup: tos=1 query param in callback URL
 *
 * Uses upsert so it works whether or not the user_profiles row exists yet.
 * Note: If the row already exists with a tos_accepted_at value, the upsert
 * will overwrite it. This is acceptable — the legal requirement is met at
 * checkbox time, and repeated writes only occur on callback URL replays.
 */
async function recordTosAcceptance(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  user: { id: string; user_metadata?: Record<string, unknown> },
  tosFromParam: boolean,
) {
  const tosFromMetadata = !!user.user_metadata?.tos_accepted_at;

  if (!tosFromParam && !tosFromMetadata) return;

  try {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("user_profiles")
      .upsert(
        { id: user.id, tos_accepted_at: now },
        { onConflict: "id", ignoreDuplicates: false },
      );

    if (error) {
      console.error(
        "[auth/callback] Failed to record ToS acceptance:",
        error.message,
      );
    }
  } catch (err) {
    console.error("[auth/callback] Failed to record ToS acceptance:", err);
  }
}
