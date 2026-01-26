/**
 * API route for user features
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const tier = searchParams.get('tier');

  try {
    // If no userId, return default/free tier features
    if (!userId) {
      const response = await fetch(
        `${BACKEND_URL}/features/user/anonymous?tier=${tier || 'free'}`,
        { headers: { 'Content-Type': 'application/json' } }
      );
      const data = await response.json();
      return NextResponse.json(data);
    }

    let url = `${BACKEND_URL}/features/user/${userId}`;
    if (tier) url += `?tier=${tier}`;

    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    // Return free tier as fallback
    return NextResponse.json({
      success: true,
      data: {
        tier: 'free',
        features: {
          analytics_assistant_enabled: false,
          saved_queries_enabled: false,
          watchlist_enabled: false,
        },
        limits: {
          analytics_queries_per_day: 0,
          saved_queries_limit: 0,
          watchlist_limit: 0,
        },
        detailed: [],
      },
    });
  }
}
