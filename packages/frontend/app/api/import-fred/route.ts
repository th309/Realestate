import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const series = searchParams.get('series') || 'mortgage_rate_30yr'
    const apiKey = searchParams.get('api_key')

    const seriesKeys = series.split(',').map(s => s.trim())

    console.log('🚀 Starting FRED import via Backend API')

    const response = await fetch(`${BACKEND_URL}/api/data-ingestion/fred?api_key=${apiKey || ''}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        series: seriesKeys
      })
    })

    const result = await response.json()

    return NextResponse.json(result, { status: response.status })

  } catch (error: any) {
    console.error('❌ FRED proxy error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 })
  }
}

