import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const variables = searchParams.get('variables') || 'population,median_household_income'
    const year = parseInt(searchParams.get('year') || '2022')
    const geoLevel = searchParams.get('geo_level') || 'metropolitan statistical area/micropolitan statistical area'
    const apiKey = searchParams.get('api_key')

    const variablesList = variables.split(',').map(v => v.trim())

    console.log('🚀 Starting Census import via Backend API')

    const response = await fetch(`${BACKEND_URL}/api/data-ingestion/census?api_key=${apiKey || ''}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        variables: variablesList,
        year,
        geoLevel
      })
    })

    const result = await response.json()

    return NextResponse.json(result, { status: response.status })

  } catch (error: any) {
    console.error('❌ Census proxy error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 })
  }
}

