import { NextResponse } from 'next/server'
import { analyzeZillowStructure } from '@/lib/data-ingestion/sources/analyze-zillow-structure'

export async function GET() {
  try {
    console.log('Starting Zillow structure analysis...')
    const analysis = await analyzeZillowStructure()
    
    return NextResponse.json({
      success: true,
      analysis,
      recommendation: {
        message: 'Based on Zillow structure, we should update our schema',
        suggestedTables: {
          'zillow_regions': 'Store RegionID, RegionName, RegionType, State, Metro, County info',
          'zillow_time_series': 'Store all time-series data with region_id, date, metric_type, value',
          'zillow_metadata': 'Store SizeRank and other metadata'
        }
      }
    })
  } catch (error: any) {
    console.error('Analysis error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
