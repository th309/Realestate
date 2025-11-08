import { NextResponse } from 'next/server'
import { fetchZillowDataSimple, storeZillowDataSimple } from '@/lib/data-ingestion/sources/zillow-simple'

/**
 * Simplified Zillow test endpoint (no Puppeteer)
 * GET /api/test-zillow-simple?datasets=zhvi,zori&store=false
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const datasetsParam = searchParams.get('datasets') || 'zhvi'
    const shouldStore = searchParams.get('store') === 'true'
    const datasets = datasetsParam.split(',').map(d => d.trim())
    
    console.log(`🧪 Testing simplified Zillow fetcher with: ${datasets.join(', ')}`)
    
    const startTime = Date.now()
    
    // Add timeout wrapper
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Operation timed out after 45 seconds')), 45000)
    })
    
    const dataPoints = await Promise.race([
      fetchZillowDataSimple(datasets),
      timeoutPromise
    ]) as any[]
    
    const duration = Date.now() - startTime
    
    let storedCount = 0
    if (shouldStore && dataPoints.length > 0) {
      console.log(`💾 Storing ${dataPoints.length} data points...`)
      await storeZillowDataSimple(dataPoints)
      storedCount = dataPoints.length
    }
    
    // Get sample data
    const sample = dataPoints.slice(0, 5)
    
    return NextResponse.json({
      success: true,
      message: `Fetched ${dataPoints.length} data points in ${duration}ms`,
      details: {
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
    console.error('❌ Test error:', error)
    
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
