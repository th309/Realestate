import { NextResponse } from 'next/server'
import { fetchZillowDataSimple, storeZillowDataSimple } from '@/lib/data-ingestion/sources/zillow-simple'

/**
 * Simplified Zillow test endpoint (no Puppeteer)
 * GET /api/test-zillow-simple?datasets=zhvi,zori&store=false
 */
export async function GET(request: Request) {
  console.log('[API] test-zillow-simple endpoint called')
  console.log('[API] Request URL:', request.url)

  try {
    return NextResponse.json({
      success: false,
      message: 'This endpoint is deprecated. Please use /api/import-zillow which uses the new backend data ingestion service.',
      deprecated: true
    }, { status: 410 })

  } catch (error: any) {
    console.error('❌ [API] Test error:', error.message)
    console.error('[API] Error type:', error.constructor.name)
    console.error('[API] Stack trace:', error.stack)
    console.error('[API] Full error object:', error)

    let errorMessage = error.message || 'Unknown error'
    let suggestion = ''

    if (error.message?.includes('timeout')) {
      errorMessage = 'Request timed out (45s limit)'
      suggestion = 'Try fewer datasets or check network connection'
    } else if (error.message?.includes('ECONNREFUSED')) {
      errorMessage = 'Connection refused'
      suggestion = 'Check internet connection or Zillow might be blocking requests'
    }

    return NextResponse.json({
      success: false,
      error: errorMessage,
      suggestion,
      details: {
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    }, { status: 500 })
  }
}
