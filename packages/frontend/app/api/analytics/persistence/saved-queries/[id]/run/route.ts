/**
 * API route for running a saved query
 */

import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

function forwardAuthHeader(request: NextRequest): Record<string, string> {
  const auth = request.headers.get("Authorization");
  return auth ? { Authorization: auth } : {};
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const body = await request.json();

    const response = await fetch(
      `${BACKEND_URL}/analytics/saved-queries/${id}/run`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...forwardAuthHeader(request),
        },
        body: JSON.stringify(body),
      },
    );

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to run saved query" },
      { status: 500 },
    );
  }
}
