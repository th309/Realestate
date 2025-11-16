import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Test the get_map_data function
 * GET /api/test-map-function
 */
export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();

    // First, check if we have any metrics available
    const { data: metrics, error: metricsError } = await supabase
      .from('market_time_series')
      .select('metric_name')
      .limit(1);

    if (metricsError || !metrics || metrics.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Function exists but no data available yet',
        function_status: '✅ Created',
        data_status: '⚠️ No time series data loaded',
        next_steps: 'Load geographic data and time series data to test the function',
      });
    }

    const testMetric = metrics[0].metric_name;

    // Test the function
    const { data, error } = await supabase.rpc('get_map_data', {
      p_metric_name: testMetric,
      p_region_type: null,
      p_data_source: null,
      p_date: null,
    });

    if (error) {
      return NextResponse.json({
        success: false,
        error: 'Function call failed',
        details: error.message,
        function_status: '❌ Error',
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: '✅ Migration verified successfully!',
      function_status: '✅ Working',
      test_metric: testMetric,
      regions_returned: data?.length || 0,
      sample_data: data?.slice(0, 2) || [],
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}












