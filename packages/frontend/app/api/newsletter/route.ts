import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";
import { RateLimiter } from "../_lib/rate-limiter";
import { sendConfirmationEmail } from "./send-confirmation-email";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

async function addToResendContacts(
  email: string,
  source: string | undefined,
): Promise<void> {
  const segmentId = process.env.RESEND_SEGMENT_ID;
  if (!resend) return;
  try {
    await resend.contacts.create({
      email,
      unsubscribed: false,
      ...(source ? { properties: { source } } : {}),
      ...(segmentId ? { segments: [{ id: segmentId }] } : {}),
    });
  } catch (err) {
    // Non-fatal — contact may already exist
    console.warn("Resend contact create skipped:", err);
  }
}

const VALID_SOURCES = ["homepage", "city-page", "exit-intent", "newsletter-page"] as const;

const newsletterSignupSchema = z.object({
  email: z.string().email("Invalid email address").max(320),
  source: z.enum(VALID_SOURCES).optional(),
});

/** 5 requests per IP per 15-minute window. */
const rateLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 15 * 60 * 1000,
});

function getClientIp(request: Request): string {
  const headers = new Headers(request.headers);
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs; the first is the client.
    return forwarded.split(",")[0].trim();
  }
  return headers.get("x-real-ip") ?? "unknown";
}

function buildConfirmationUrl(token: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL is not configured");
  }
  return `${appUrl}/api/newsletter/confirm?token=${token}`;
}

export async function POST(request: Request) {
  // --- Rate limiting ---
  const clientIp = getClientIp(request);
  const rateCheck = rateLimiter.check(clientIp);

  if (rateCheck.limited) {
    return NextResponse.json(
      {
        error: "Too many requests. Please try again later.",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateCheck.retryAfterSeconds),
        },
      },
    );
  }

  // --- Input validation ---
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const parsed = newsletterSignupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid email", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { email, source } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  // --- Check for existing confirmed subscriber ---
  const supabase = createSupabaseAdminClient();

  const { data: existing } = await supabase
    .from("newsletter_signups")
    .select("confirmed")
    .eq("email", normalizedEmail)
    .single();

  if (existing?.confirmed) {
    // Already confirmed — tell the user without revealing subscription status
    // to avoid email enumeration. Return the same success message.
    return NextResponse.json({
      success: true,
      message: "Please check your email to confirm your subscription.",
    });
  }

  // --- Generate confirmation token and upsert ---
  const confirmationToken = crypto.randomUUID();

  const { error: upsertError } = await supabase
    .from("newsletter_signups")
    .upsert(
      {
        email: normalizedEmail,
        subscribed_at: new Date().toISOString(),
        confirmation_token: confirmationToken,
        confirmed: false,
        confirmed_at: null,
        ...(source ? { source } : {}),
      },
      { onConflict: "email" },
    );

  if (upsertError) {
    console.error("Newsletter signup error:", upsertError);
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
  }

  // --- Add to Resend contacts (non-blocking) ---
  void addToResendContacts(normalizedEmail, source);

  // --- Send confirmation email ---
  const confirmationUrl = buildConfirmationUrl(confirmationToken);
  const emailResult = await sendConfirmationEmail({
    to: normalizedEmail,
    confirmationUrl,
  });

  if (!emailResult.sent) {
    console.error(
      "Failed to send newsletter confirmation email:",
      emailResult.error,
    );
    // Still return success — the user can re-submit to get a new email.
    // We do not expose email delivery failures to the client.
  }

  return NextResponse.json({
    success: true,
    message: "Please check your email to confirm your subscription.",
  });
}
