/**
 * Lead Magnet API Route
 *
 * Captures name + email for a free market report lead magnet.
 * Adds the contact to a Resend audience for future email delivery.
 * Falls back to console logging in dev when RESEND_API_KEY is not set.
 */

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { RateLimiter } from "../_lib/rate-limiter";

const leadMagnetSchema = z.object({
  firstName: z
    .string()
    .min(1, "First name is required")
    .max(100, "First name is too long")
    .trim(),
  email: z.string().email("Invalid email address").max(320),
  metroName: z.string().max(200).optional(),
});

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

/** 5 requests per IP per 15-minute window. */
const rateLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 15 * 60 * 1000,
});

function getClientIp(request: Request): string {
  const headers = new Headers(request.headers);
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return headers.get("x-real-ip") ?? "unknown";
}

export async function POST(request: Request) {
  // --- Rate limiting ---
  const clientIp = getClientIp(request);
  const rateCheck = rateLimiter.check(clientIp);

  if (rateCheck.limited) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: { "Retry-After": String(rateCheck.retryAfterSeconds) },
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

  const parsed = leadMagnetSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const firstError = Object.values(fieldErrors).flat()[0] || "Invalid input";
    return NextResponse.json({ error: firstError }, { status: 400 });
  }

  const { firstName, email, metroName } = parsed.data;
  const normalizedEmail = email.toLowerCase();

  // --- Add contact to Resend audience ---
  const audienceId = process.env.RESEND_LEAD_MAGNET_AUDIENCE_ID;

  if (!resend) {
    console.log(
      `[DEV] Lead magnet capture: ${firstName} <${normalizedEmail}> for "${metroName ?? "unknown"}"`,
    );
    return NextResponse.json({
      success: true,
      message: "Your free report request has been received.",
    });
  }

  if (!audienceId) {
    console.error(
      "RESEND_LEAD_MAGNET_AUDIENCE_ID is not configured. Contact was not added.",
    );
    // Still return success to the user — we don't expose infra issues.
    return NextResponse.json({
      success: true,
      message: "Your free report request has been received.",
    });
  }

  try {
    const { error } = await resend.contacts.create({
      audienceId,
      email: normalizedEmail,
      firstName,
      unsubscribed: false,
    });

    if (error) {
      console.error("Resend contacts.create error:", error);
      // Return success to user — backend issue should not block UX.
      return NextResponse.json({
        success: true,
        message: "Your free report request has been received.",
      });
    }
  } catch (err) {
    console.error("Failed to add lead magnet contact:", err);
    return NextResponse.json({
      success: true,
      message: "Your free report request has been received.",
    });
  }

  return NextResponse.json({
    success: true,
    message: "Your free report request has been received.",
  });
}
