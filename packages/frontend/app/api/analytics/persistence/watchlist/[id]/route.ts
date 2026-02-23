/**
 * API route for watchlist by ID
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

function forwardAuthHeader(request: NextRequest): Record<string, string> {
  const auth = request.headers.get('Authorization');
  return auth ? { Authorization: auth } : {};
}

async function parseBackendResponse(response: Response) {
  const data = await response.json();
  if (response.ok && data.success !== undefined) return data;
  if (response.ok) return { success: true, data };
  return {
    success: false,
    error: data.message || data.error || `Request failed (${response.status})`,
  };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();

    const response = await fetch(`${BACKEND_URL}/analytics/watchlist/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...forwardAuthHeader(request) },
      body: JSON.stringify(body),
    });

    const result = await parseBackendResponse(response);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to update watchlist item' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'userId is required' },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(
      `${BACKEND_URL}/analytics/watchlist/${id}?userId=${userId}`,
      { method: 'DELETE', headers: forwardAuthHeader(request) }
    );
    const result = await parseBackendResponse(response);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to remove from watchlist' },
      { status: 500 }
    );
  }
}
