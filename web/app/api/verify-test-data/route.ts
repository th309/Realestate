import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

/**
 * Verify test data was inserted correctly
 * GET /api/verify-test-data
 */
export async function GET() {
  try {
    const supabase = createSupabaseAdminClient()

    // Count by geo_type
    const { data: geoData, error: geoError } = await supabase
      .from('geo_data')
      .select('geo_code, geo_name, geo_type')
      .order('geo_type, geo_name')

    if (geoError) {
      return NextResponse.json(
        { success: false, error: `Failed to query geo_data: ${geoError.message}` },
        { status: 500 }
      )
    }

    // Count time series
    const { data: timeSeries, error: tsError } = await supabase
      .from('time_series_data')
      .select('geo_code, date, home_value')
      .order('date')

    if (tsError) {
      return NextResponse.json(
        { success: false, error: `Failed to query time_series_data: ${tsError.message}` },
        { status: 500 }
      )
    }

    // Get scores
    const { data: scores, error: scoresError } = await supabase
      .from('current_scores')
      .select('geo_code, home_buyer_score, investor_score')
      .order('investor_score', { ascending: false })

    if (scoresError) {
      return NextResponse.json(
        { success: false, error: `Failed to query current_scores: ${scoresError.message}` },
        { status: 500 }
      )
    }

    // Group by type
    const byType = geoData?.reduce((acc: any, item) => {
      acc[item.geo_type] = (acc[item.geo_type] || 0) + 1
      return acc
    }, {}) || {}

    return NextResponse.json({
      success: true,
      summary: {
        totalMarkets: geoData?.length || 0,
        byType: byType,
        timeSeriesRecords: timeSeries?.length || 0,
        marketsWithScores: scores?.length || 0
      },
      data: {
        markets: geoData,
        timeSeries: timeSeries,
        scores: scores
      }
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: `Verification failed: ${error.message}`
      },
      { status: 500 }
    )
  }
}

