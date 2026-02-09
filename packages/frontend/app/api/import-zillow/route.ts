import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const metric = searchParams.get('metric') || 'zhvi'
    const limit = searchParams.get('limit')
    const isTest = searchParams.get('test') === 'true'

    console.log('🚀 Starting Zillow import via Backend API')
    console.log(`Parameters: metric=${metric}, limit=${limit}, test=${isTest}`)

    const limitRows = limit ? parseInt(limit) : (isTest ? 5 : undefined)

    const response = await fetch(`${BACKEND_URL}/api/data-ingestion/zillow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        metric,
        limit: limitRows
      })
    })

    const result = await response.json()

    // Transform backend result to match frontend expectation if needed
    // Backend returns: { success, message, details: { marketsCreated, timeSeriesInserted, errors, errorDetails } }
    // Frontend expects similar structure.

    return NextResponse.json(result, { status: response.status })

  } catch (error: any) {
    console.error('❌ Zillow proxy error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 })
  }
}
