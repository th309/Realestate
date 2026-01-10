import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Dynamic Map Data API
 * GET /api/map-data?metric=zhvi&region_type=state&data_source=zillow&date=2024-01-01
 * 
 * Returns geographic data with metric values for map visualization.
 * No metrics are hardcoded - the map is purely a visualization layer.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const metricName = searchParams.get('metric');
    const regionType = searchParams.get('region_type') || null;
    const dataSource = searchParams.get('data_source') || null;
    const dateParam = searchParams.get('date') || null;

    if (!metricName) {
      return NextResponse.json(
        { 
          error: 'metric parameter is required',
          example: '/api/map-data?metric=zhvi&region_type=state'
        },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Parse date if provided
    const date = dateParam ? new Date(dateParam) : null;

    // Call the flexible function
    const { data, error } = await supabase.rpc('get_map_data', {
      p_metric_name: metricName,
      p_region_type: regionType,
      p_data_source: dataSource,
      p_date: date ? date.toISOString().split('T')[0] : null,
    });

    if (error) {
      console.error('Error fetching map data:', error);
      return NextResponse.json(
        { error: 'Failed to fetch map data', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      metric: metricName,
      region_type: regionType || 'all',
      data_source: dataSource || 'all',
      date: dateParam || 'latest',
      count: data?.length || 0,
      data: data || [],
    });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

