import { fetchZillowData, storeZillowData } from '@/lib/data-ingestion/sources/zillow'
import { NextResponse } from 'next/server'

/**
 * Test Zillow data fetcher
 * GET /api/test-zillow?datasets=zhvi,inventory&store=false
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const datasetsParam = searchParams.get('datasets') || 'zhvi'
    const shouldStore = searchParams.get('store') === 'true'
    const datasets = datasetsParam.split(',')

    console.log(`🧪 Testing Zillow fetcher with datasets: ${datasets.join(', ')}`)

    // Fetch data
    const startTime = Date.now()
    const dataPoints = await fetchZillowData(datasets)
    const duration = Date.now() - startTime

    let storedCount = 0
    if (shouldStore && dataPoints.length > 0) {
      console.log(`💾 Storing ${dataPoints.length} data points...`)
      await storeZillowData(dataPoints)
      storedCount = dataPoints.length
    }

    // Sample first few data points
    const sample = dataPoints.slice(0, 5)

    return NextResponse.json({
      success: true,
      message: `Fetched ${dataPoints.length} data points in ${duration}ms`,
      summary: {
        totalDataPoints: dataPoints.length,
        datasets: datasets,
        durationMs: duration,
        stored: storedCount,
        sampleSize: sample.length
      },
      sample: sample,
      note: shouldStore 
        ? `${storedCount} records stored in database`
        : 'Set ?store=true to store in database'
    })
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

