/**
 * API route for conversations by ID
 */

import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

function forwardAuthHeader(request: NextRequest): Record<string, string> {
  const auth = request.headers.get("Authorization");
  return auth ? { Authorization: auth } : {};
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params;

  try {
    const response = await fetch(
      `${BACKEND_URL}/analytics/conversations/${conversationId}`,
      {
        headers: {
          "Content-Type": "application/json",
          ...forwardAuthHeader(request),
        },
      },
    );
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch conversation" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const { conversationId } = await params;

  try {
    const response = await fetch(
      `${BACKEND_URL}/analytics/conversations/${conversationId}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...forwardAuthHeader(request),
        },
      },
    );
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to delete conversation" },
      { status: 500 },
    );
  }
}
