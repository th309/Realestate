/**
 * Same-origin proxy for /api/usage/heartbeat. See ./events/route.ts for rationale.
 */
import { NextRequest } from "next/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  if (!BACKEND_URL) {
    return new Response(null, { status: 204 });
  }

  const body = await request.text();

  fetch(`${BACKEND_URL}/api/usage/heartbeat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch((err) => {
    console.warn("[usage-proxy] heartbeat forward failed:", err?.message);
  });

  return new Response(null, { status: 204 });
}
