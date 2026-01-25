/**
 * Analytics Chat Health Check
 *
 * Check if the analytics chat service is available.
 */

import { NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/analytics/chat/health`, {
      method: 'GET',
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Analytics chat health check failed:', error);
    return NextResponse.json(
      {
        available: false,
        error: 'Failed to connect to analytics service',
      },
      { status: 503 }
    );
  }
}
