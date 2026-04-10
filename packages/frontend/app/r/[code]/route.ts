import { NextRequest, NextResponse } from "next/server";

/**
 * Referral redirect handler.
 * Sets a 60-day attribution cookie then redirects to /pricing.
 *
 * URL pattern: propertyiq.app/r/{code}
 *
 * The cookie is read by the auth callback after signup and sent to the
 * backend to attribute the new user to the referrer.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;

  // Basic sanity check — codes are 8 lowercase alphanumeric chars
  if (!code || !/^[a-z0-9]{4,20}$/.test(code)) {
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
    const origin = forwardedHost
      ? `${forwardedProto}://${forwardedHost}`
      : request.nextUrl.origin;
    return NextResponse.redirect(`${origin}/pricing`);
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  const origin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : request.nextUrl.origin;

  const response = NextResponse.redirect(`${origin}/pricing`);

  // 60-day attribution cookie
  const sixtyDays = 60 * 24 * 60 * 60;
  response.cookies.set("piq_ref", code, {
    maxAge: sixtyDays,
    path: "/",
    sameSite: "lax",
    httpOnly: false, // Must be readable by JS in the auth callback
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
