import { fetchZillowData, storeZillowData } from '@/lib/data-ingestion/sources/zillow'
import { NextResponse } from 'next/server'

/**
 * Test Zillow data fetcher
 * GET /api/test-zillow?datasets=zhvi,inventory&store=false
 */
export async function GET(request: Request) {
  try {
    return NextResponse.json({
      success: false,
      message: 'This endpoint is deprecated. Please use /api/import-zillow which uses the new backend data ingestion service.',
      deprecated: true
    }, { status: 410 })
  } catch (error: any) {
    console.error('❌ Zillow fetcher error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

