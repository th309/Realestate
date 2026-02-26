import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const confirmTokenSchema = z.object({
  token: z.string().uuid("Invalid confirmation token"),
});

/**
 * GET /api/newsletter/confirm?token=<uuid>
 *
 * Confirms a newsletter subscription via the double opt-in token.
 * Redirects to the homepage with a query param indicating success or failure,
 * so the frontend can show an appropriate toast/message.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const tokenParam = searchParams.get("token");

  // --- Validate token format ---
  const parsed = confirmTokenSchema.safeParse({ token: tokenParam });
  if (!parsed.success) {
    return buildConfirmationPage({
      success: false,
      message: "Invalid confirmation link. Please try subscribing again.",
    });
  }

  const { token } = parsed.data;
  const supabase = createSupabaseAdminClient();

  // --- Look up unconfirmed signup by token ---
  const { data: signup, error: lookupError } = await supabase
    .from("newsletter_signups")
    .select("id, email, confirmed")
    .eq("confirmation_token", token)
    .single();

  if (lookupError || !signup) {
    return buildConfirmationPage({
      success: false,
      message:
        "Confirmation link not found or expired. Please try subscribing again.",
    });
  }

  if (signup.confirmed) {
    return buildConfirmationPage({
      success: true,
      message: "Your subscription is already confirmed!",
    });
  }

  // --- Confirm the subscription ---
  const { error: updateError } = await supabase
    .from("newsletter_signups")
    .update({
      confirmed: true,
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", signup.id);

  if (updateError) {
    console.error("Newsletter confirmation error:", updateError);
    return buildConfirmationPage({
      success: false,
      message: "Something went wrong. Please try again later.",
    });
  }

  return buildConfirmationPage({
    success: true,
    message:
      "Your subscription is confirmed! Welcome to Weekly Market Insights.",
  });
}

/**
 * Returns a simple, styled HTML page for the confirmation result.
 * This is displayed when the user clicks the confirmation link from their email.
 */
function buildConfirmationPage(params: {
  success: boolean;
  message: string;
}): NextResponse {
  const { success, message } = params;

  const iconSvg = success
    ? `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
    : `<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Newsletter ${success ? "Confirmed" : "Error"} - PropertyIQ</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #fafafa;
      color: #1a1a1a;
    }
    .card {
      text-align: center;
      padding: 48px 32px;
      max-width: 440px;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .icon { margin-bottom: 16px; }
    h1 { font-size: 22px; margin: 0 0 12px; }
    p { font-size: 16px; color: #555; line-height: 1.5; margin: 0 0 24px; }
    a {
      display: inline-block;
      padding: 12px 28px;
      background: #6B21A8;
      color: #fff;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
    }
    a:hover { background: #581c87; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${iconSvg}</div>
    <h1>${success ? "You're all set!" : "Something went wrong"}</h1>
    <p>${message}</p>
    <a href="/">Go to PropertyIQ</a>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    status: success ? 200 : 400,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
