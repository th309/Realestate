/**
 * API route for saved queries
 */

import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

function forwardAuthHeader(request: NextRequest): Record<string, string> {
  const auth = request.headers.get("Authorization");
  return auth ? { Authorization: auth } : {};
}

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${BACKEND_URL}/analytics/saved-queries`, {
      headers: {
        "Content-Type": "application/json",
        ...forwardAuthHeader(request),
      },
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch saved queries" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${BACKEND_URL}/analytics/saved-queries`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...forwardAuthHeader(request),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to create saved query" },
      { status: 500 },
    );
  }
}
