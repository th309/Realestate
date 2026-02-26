/**
 * API route for saved queries by ID
 */

import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

function forwardAuthHeader(request: NextRequest): Record<string, string> {
  const auth = request.headers.get("Authorization");
  return auth ? { Authorization: auth } : {};
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const response = await fetch(
      `${BACKEND_URL}/analytics/saved-queries/${id}`,
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
      { success: false, error: "Failed to fetch saved query" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const body = await request.json();

    const response = await fetch(
      `${BACKEND_URL}/analytics/saved-queries/${id}`,
      {
        method: "PUT",
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
      { success: false, error: "Failed to update saved query" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const response = await fetch(
      `${BACKEND_URL}/analytics/saved-queries/${id}`,
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
      { success: false, error: "Failed to delete saved query" },
      { status: 500 },
    );
  }
}
