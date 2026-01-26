/**
 * Analytics Chat API Route
 *
 * Proxies requests to the NestJS backend analytics chat service.
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

// Debug: Log backend URL on module load (will appear in Vercel logs)
console.log('[Quinn API Route] BACKEND_URL configured as:', BACKEND_URL);
console.log('[Quinn API Route] Environment check:', {
  hasBackendUrl: !!process.env.BACKEND_URL,
  nodeEnv: process.env.NODE_ENV,
});

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
  const startTime = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  console.log(`[Quinn POST ${requestId}] === REQUEST START ===`);
  console.log(`[Quinn POST ${requestId}] BACKEND_URL:`, BACKEND_URL);
  
  try {
    const { conversationId } = await context.params;
    console.log(`[Quinn POST ${requestId}] ConversationId:`, conversationId);
    
    const body = await request.json();
    console.log(`[Quinn POST ${requestId}] Message:`, body.message?.slice(0, 100));
    console.log(`[Quinn POST ${requestId}] Context:`, JSON.stringify(body.context || {}));

    const targetUrl = `${BACKEND_URL}/analytics/chat/${conversationId}`;
    console.log(`[Quinn POST ${requestId}] Fetching:`, targetUrl);

    const fetchStartTime = Date.now();
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const fetchDuration = Date.now() - fetchStartTime;

    console.log(`[Quinn POST ${requestId}] Backend response status:`, response.status);
    console.log(`[Quinn POST ${requestId}] Backend response time:`, `${fetchDuration}ms`);
    console.log(`[Quinn POST ${requestId}] Response headers:`, Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log(`[Quinn POST ${requestId}] Raw response length:`, responseText.length);
    console.log(`[Quinn POST ${requestId}] Raw response preview:`, responseText.slice(0, 500));

    let data;
    try {
      data = JSON.parse(responseText);
      console.log(`[Quinn POST ${requestId}] Parsed response success:`, data.success);
      if (data.error) {
        console.error(`[Quinn POST ${requestId}] Backend error:`, data.error);
      }
      if (data.modelUsed) {
        console.log(`[Quinn POST ${requestId}] Model used:`, data.modelUsed);
      }
      if (data.toolsUsed) {
        console.log(`[Quinn POST ${requestId}] Tools used:`, data.toolsUsed);
      }
    } catch (parseError) {
      console.error(`[Quinn POST ${requestId}] JSON parse error:`, parseError);
      console.error(`[Quinn POST ${requestId}] Non-JSON response:`, responseText.slice(0, 1000));
      return NextResponse.json(
        {
          success: false,
          error: 'Backend returned invalid JSON',
          debug: {
            requestId,
            status: response.status,
            responsePreview: responseText.slice(0, 200),
          },
        },
        { status: 502 }
      );
    }

    const totalDuration = Date.now() - startTime;
    console.log(`[Quinn POST ${requestId}] === REQUEST END === Total time: ${totalDuration}ms`);
    
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const totalDuration = Date.now() - startTime;
    const err = error as Error;
    
    console.error(`[Quinn POST ${requestId}] === REQUEST FAILED ===`);
    console.error(`[Quinn POST ${requestId}] Error name:`, err.name);
    console.error(`[Quinn POST ${requestId}] Error message:`, err.message);
    console.error(`[Quinn POST ${requestId}] Error stack:`, err.stack);
    console.error(`[Quinn POST ${requestId}] Time until failure:`, `${totalDuration}ms`);
    console.error(`[Quinn POST ${requestId}] BACKEND_URL was:`, BACKEND_URL);
    
    // Check for specific error types
    const errorDetails: Record<string, string> = {
      requestId,
      errorType: err.name,
      message: err.message,
      backendUrl: BACKEND_URL,
    };
    
    if (err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED')) {
      errorDetails.hint = 'Backend server may be down or unreachable';
    } else if (err.message.includes('ENOTFOUND')) {
      errorDetails.hint = 'Backend URL hostname could not be resolved';
    } else if (err.message.includes('timeout')) {
      errorDetails.hint = 'Request timed out - backend may be overloaded';
    }
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to connect to analytics service',
        debug: errorDetails,
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
