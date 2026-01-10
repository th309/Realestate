import { NextResponse } from 'next/server'
import { importZillowData, testZillowImport } from '@/lib/data-ingestion/sources/zillow-v2'

/**
 * API endpoint to trigger Zillow data import
 * GET /api/import-zillow?metric=zhvi&limit=5&test=true
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const metric = searchParams.get('metric') || 'zhvi'
    const limit = searchParams.get('limit')
    const isTest = searchParams.get('test') === 'true'
    
    console.log('🚀 Starting Zillow import via API')
    console.log(`Parameters: metric=${metric}, limit=${limit}, test=${isTest}`)
    
    let result
    
    if (isTest) {
      // Test mode: import only 5 regions
      result = await testZillowImport()
    } else {
      // Full import
      const limitRows = limit ? parseInt(limit) : undefined
      result = await importZillowData(metric, limitRows)
    }
    
    return NextResponse.json({
      success: result.success,
      message: result.message,
      details: {
        marketsCreated: result.marketsCreated,
        timeSeriesInserted: result.timeSeriesInserted,
        errors: result.errors,
        errorDetails: result.errorDetails || []
      }
    })
    
  } catch (error: any) {
    console.error('❌ Import error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}
