import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/app/api/auth/send-welcome-email";

/**
 * POST /api/auth/welcome
 *
 * Sends a welcome email to the currently authenticated user.
 * Called fire-and-forget from the signup page when autoconfirm is enabled
 * (which bypasses the Supabase email hook that would normally trigger it).
 */
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const name =
    (user.user_metadata?.full_name as string) ||
    user.email.split("@")[0] ||
    "there";

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const origin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : request.nextUrl.origin;

  // A stateless email link can't carry a session, so point it at the sign-in
  // gate (which forwards to ?redirect= after login, or instantly forwards a
  // user whose session is still live) rather than deep-linking into /map and
  // rendering the anonymous map for a user who appears logged out.
  const result = await sendWelcomeEmail({
    to: user.email,
    name,
    loginUrl: `${origin}/auth/sign-in?redirect=/map`,
  });

  return NextResponse.json(result);
}
