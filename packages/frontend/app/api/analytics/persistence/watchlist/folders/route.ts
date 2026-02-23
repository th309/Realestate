/**
 * API route for watchlist folders
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

export async function GET(request: NextRequest) {
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
      `${BACKEND_URL}/analytics/watchlist/folders?userId=${userId}`,
      { headers: { 'Content-Type': 'application/json', ...forwardAuthHeader(request) } }
    );
    const result = await parseBackendResponse(response);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch folders' },
      { status: 500 }
    );
  }
}
