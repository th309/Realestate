import { NextResponse } from 'next/server'
import { importCensusData } from '@/lib/data-ingestion/sources/census'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const variables = searchParams.get('variables') || 'population,median_household_income'
    const year = parseInt(searchParams.get('year') || '2022')
    const geoLevel = searchParams.get('geo_level') || 'metropolitan statistical area/micropolitan statistical area'
    const apiKey = searchParams.get('api_key')
    
    const variablesList = variables.split(',').map(v => v.trim())
    
    console.log('🚀 Starting Census import via API')
    console.log(`Parameters: variables=${variablesList.join(', ')}, year=${year}, geo_level=${geoLevel}`)
    
    const result = await importCensusData(
      variablesList,
      year,
      geoLevel as any,
      apiKey || undefined
    )
    
    return NextResponse.json({
      success: result.success,
      message: result.message,
      details: {
        recordsInserted: result.recordsInserted,
        errors: result.errors.length,
        errorDetails: result.errors.slice(0, 10)
      }
    })
    
  } catch (error: any) {
    console.error('❌ Census import error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}

