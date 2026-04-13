import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/auth/debug-log
 * Temporary debug endpoint — logs auth callback steps to Railway server logs.
 * Client-side console.log doesn't appear in server logs, so the callback
 * page POSTs here at each step to make the flow visible.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { step, data, error } = body;
  const ts = new Date().toISOString();

  if (error) {
    console.error(`[AUTH-DEBUG ${ts}] step=${step} ERROR:`, data, error);
  } else {
    console.log(`[AUTH-DEBUG ${ts}] step=${step}`, JSON.stringify(data));
  }

  return NextResponse.json({ ok: true });
}
