/**
 * Analytics Chat API Route
 *
 * Proxies requests to the NestJS backend analytics chat service.
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

interface RouteContext {
  params: Promise<{ conversationId: string }>;
}

/**
 * POST /api/analytics/chat/:conversationId
 * Send a chat message
 */
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { conversationId } = await context.params;
    const body = await request.json();

    const response = await fetch(
      `${BACKEND_URL}/analytics/chat/${conversationId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Analytics chat proxy error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to connect to analytics service',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/analytics/chat/:conversationId
 * Get conversation history
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { conversationId } = await context.params;

    const response = await fetch(
      `${BACKEND_URL}/analytics/chat/${conversationId}`,
      { method: 'GET' }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Analytics chat proxy error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to connect to analytics service',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/analytics/chat/:conversationId
 * Clear conversation
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { conversationId } = await context.params;

    const response = await fetch(
      `${BACKEND_URL}/analytics/chat/${conversationId}`,
      { method: 'DELETE' }
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Analytics chat proxy error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to connect to analytics service',
      },
      { status: 500 }
    );
  }
}
