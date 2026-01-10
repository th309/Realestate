import { NextResponse } from 'next/server'
import axios from 'axios'

const CENSUS_API_BASE = 'https://api.census.gov/data'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || '2022')
    const apiKey = searchParams.get('api_key') || process.env.CENSUS_API_KEY

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'Census API key is required'
      }, { status: 400 })
    }

    const dataset = 'acs/acs5'
    const geoLevel = 'metropolitan statistical area/micropolitan statistical area'
    
    const url = `${CENSUS_API_BASE}/${year}/${dataset}?get=NAME&for=${geoLevel}:*&key=${apiKey}`
    
    console.log(`📥 Fetching metro areas from Census API...`)

    const response = await axios.get(url, {
      timeout: 60000
    })

    const data = response.data
    if (!Array.isArray(data) || data.length < 2) {
      throw new Error('Invalid Census API response format')
    }

    const rows = data.slice(1)
    const metroCount = rows.length

    const sampleMetros = rows.slice(0, 20).map((row: string[]) => row[0])

    return NextResponse.json({
      success: true,
      year,
      totalMetroAreas: metroCount,
      sampleMetros,
      message: `Census API has ${metroCount} metro areas for year ${year}`
    })
    
  } catch (error: any) {
    console.error('❌ Error counting Census metros:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}

