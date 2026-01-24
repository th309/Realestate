import { NextResponse } from 'next/server'
import { analyzeZillowStructure } from '@/lib/data-ingestion/sources/analyze-zillow-structure'

export async function GET() {
  try {
    return NextResponse.json({
      success: false,
      message: 'This analysis endpoint is deprecated as the schema has been finalized and data ingestion moved to backend.',
      deprecated: true
    }, { status: 410 })
  } catch (error: any) {
    console.error('Analysis error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
