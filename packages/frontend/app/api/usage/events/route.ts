/**
 * Same-origin proxy for /api/usage/events.
 *
 * Privacy extensions (uBlock, EasyPrivacy lists, Adblock Plus) block
 * third-party requests to tracker-shaped paths like /events. Routing the
 * beacon through www.propertyiq.app makes the request first-party and
 * survives those blocklists.
 *
 * Fire-and-forget: respond 202 immediately, forward to backend in the
 * background. Frontend tracker already treats this as fire-and-forget
 * (keepalive fetch with .catch noop), so propagating backend status
 * would only enable retry storms on transient backend errors.
 */
import { NextRequest } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  if (!BACKEND_URL) {
    return new Response(null, { status: 202 });
  }

  const body = await request.text();

  fetch(`${BACKEND_URL}/api/usage/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch((err) => {
    console.warn("[usage-proxy] events forward failed:", err?.message);
  });

  return new Response(null, { status: 202 });
}
