import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Verify Redfin data was imported correctly
 * GET /api/verify-redfin-data?filename=optional-filename
 * 
 * If filename is provided, only verifies data from that specific file
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const filename = searchParams.get('filename')
    
    const supabase = createSupabaseAdminClient()

    // Build query filters
    let marketsQuery = supabase
      .from('markets')
      .select('region_type, region_name, state_code, state_name')
      .like('region_id', 'REDFIN-%')
      .order('region_type, region_name')

    let timeSeriesQuery = supabase
      .from('market_time_series')
      .select('metric_name, date, metric_value, region_id')
      .eq('data_source', 'redfin')
      .order('date', { ascending: false })

    // If filename is provided, filter by it in attributes
    if (filename) {
      timeSeriesQuery = timeSeriesQuery.contains('attributes', { source_file: filename })
    }

    // 1. Count Redfin markets by region type
    const { data: marketsByType, error: marketsError } = await marketsQuery

    if (marketsError) {
      return NextResponse.json(
        { success: false, error: `Failed to query markets: ${marketsError.message}` },
        { status: 500 }
      )
    }

    // Group markets by type
    const marketsByTypeMap = new Map<string, any[]>()
    marketsByType?.forEach(market => {
      const type = market.region_type || 'unknown'
      if (!marketsByTypeMap.has(type)) {
        marketsByTypeMap.set(type, [])
      }
      marketsByTypeMap.get(type)!.push(market)
    })

    // 2. Count time series records by metric
    const { data: timeSeriesStats, error: tsError } = await timeSeriesQuery

    if (tsError) {
      return NextResponse.json(
        { success: false, error: `Failed to query time series: ${tsError.message}` },
        { status: 500 }
      )
    }

    // Group by metric
    const metricsMap = new Map<string, { count: number; minDate: string; maxDate: string; sampleValues: number[] }>()
    const dateSet = new Set<string>()
    
    timeSeriesStats?.forEach(record => {
      const metric = record.metric_name || 'unknown'
      if (!metricsMap.has(metric)) {
        metricsMap.set(metric, { count: 0, minDate: '9999-12-31', maxDate: '0000-01-01', sampleValues: [] })
      }
      const stats = metricsMap.get(metric)!
      stats.count++
      if (record.date < stats.minDate) stats.minDate = record.date
      if (record.date > stats.maxDate) stats.maxDate = record.date
      if (stats.sampleValues.length < 5 && record.metric_value !== null) {
        stats.sampleValues.push(record.metric_value)
      }
      if (record.date) dateSet.add(record.date)
    })

    // 3. Get unique regions with time series data
    const uniqueRegions = new Set(timeSeriesStats?.map(r => r.region_id) || [])
    
    // 4. Get records for verification
    // Check if we want more records (for "View Records" button)
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10
    const showAll = searchParams.get('showAll') === 'true'
    
    // First get time series records
    let sampleTimeSeriesQuery = supabase
      .from('market_time_series')
      .select('region_id, date, metric_name, metric_value, data_source, attributes')
      .eq('data_source', 'redfin')
      .order('date', { ascending: false })
      .limit(showAll ? Math.min(limit, 10000) : limit) // Cap at 10,000 for performance

    if (filename) {
      sampleTimeSeriesQuery = sampleTimeSeriesQuery.contains('attributes', { source_file: filename })
    }

    const { data: sampleTimeSeries, error: sampleTsError } = await sampleTimeSeriesQuery

    // Then get market details for those regions
    let sampleRecords: any[] = []
    if (sampleTimeSeries && sampleTimeSeries.length > 0) {
      const regionIds = [...new Set(sampleTimeSeries.map(r => r.region_id))]
      const { data: sampleMarkets, error: sampleMarketError } = await supabase
        .from('markets')
        .select('region_id, region_name, region_type, state_code, state_name')
        .in('region_id', regionIds)

      if (!sampleMarketError && sampleMarkets) {
        const marketMap = new Map(sampleMarkets.map(m => [m.region_id, m]))
        sampleRecords = sampleTimeSeries.map(ts => ({
          region: marketMap.get(ts.region_id)?.region_name || ts.region_id,
          regionType: marketMap.get(ts.region_id)?.region_type,
          state: marketMap.get(ts.region_id)?.state_code || marketMap.get(ts.region_id)?.state_name,
          date: ts.date,
          metric: ts.metric_name,
          value: ts.metric_value,
          regionId: ts.region_id,
          attributes: ts.attributes
        }))
      } else {
        // Fallback if market lookup fails
        sampleRecords = sampleTimeSeries.map(ts => ({
          region: ts.region_id,
          regionType: null,
          state: null,
          date: ts.date,
          metric: ts.metric_name,
          value: ts.metric_value,
          regionId: ts.region_id,
          attributes: ts.attributes
        }))
      }
    }

    const sampleError = sampleTsError

    if (sampleError) {
      console.warn('Failed to get sample records:', sampleError.message)
    }

    // 5. Get date range statistics
    const dates = Array.from(dateSet).sort()
    const minDate = dates[0] || null
    const maxDate = dates[dates.length - 1] || null

    // 6. Count total records
    const totalRecords = timeSeriesStats?.length || 0
    const totalMarkets = marketsByType?.length || 0

    // 7. Get metrics breakdown
    const metricsBreakdown = Array.from(metricsMap.entries()).map(([metric, stats]) => ({
      metric,
      count: stats.count,
      dateRange: {
        min: stats.minDate === '9999-12-31' ? null : stats.minDate,
        max: stats.maxDate === '0000-01-01' ? null : stats.maxDate
      },
      sampleValues: stats.sampleValues
    })).sort((a, b) => b.count - a.count)

    // 8. Group markets by type for summary
    const marketsSummary = Array.from(marketsByTypeMap.entries()).map(([type, markets]) => ({
      type,
      count: markets.length,
      sample: markets.slice(0, 5).map(m => ({
        name: m.region_name,
        state: m.state_code || m.state_name
      })),
      // For states, show all of them for debugging
      all: type === 'state' ? markets.map(m => ({
        name: m.region_name,
        stateCode: m.state_code,
        stateName: m.state_name,
        regionId: m.region_id
      })) : undefined
    }))

    return NextResponse.json({
      success: true,
      filename: filename || null,
      summary: {
        totalMarkets: totalMarkets,
        totalTimeSeriesRecords: totalRecords,
        uniqueRegionsWithData: uniqueRegions.size,
        dateRange: {
          min: minDate,
          max: maxDate,
          totalMonths: dates.length
        }
      },
      marketsByType: marketsSummary,
      metricsBreakdown: metricsBreakdown,
      sampleRecords: sampleRecords,
      recordCount: sampleRecords.length,
      details: {
        totalMarkets,
        totalRecords,
        uniqueRegions: uniqueRegions.size,
        uniqueMetrics: metricsMap.size,
        uniqueDates: dates.length
      }
    })
  } catch (error: any) {
    console.error('Error verifying Redfin data:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to verify Redfin data'
      },
      { status: 500 }
    )
  }
}
