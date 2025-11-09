import { NextResponse } from 'next/server'
import { importFREDData } from '@/lib/data-ingestion/sources/fred'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const series = searchParams.get('series') || 'mortgage_rate_30yr'
    const apiKey = searchParams.get('api_key')
    
    const seriesKeys = series.split(',').map(s => s.trim())
    
    console.log('🚀 Starting FRED import via API')
    console.log(`Parameters: series=${seriesKeys.join(', ')}, api_key=${apiKey ? 'provided' : 'from env'}`)
    
    const result = await importFREDData(seriesKeys, apiKey || undefined)
    
    return NextResponse.json({
      success: result.success,
      message: result.message,
      details: {
        recordsInserted: result.recordsInserted,
        errors: result.errors.length,
        errorDetails: result.errors
      }
    })
    
  } catch (error: any) {
    console.error('❌ FRED import error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}

