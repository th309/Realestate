import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * Available Metrics API
 * GET /api/metrics
 * 
 * Returns all available metrics with their data sources.
 * Used to populate metric selectors in the UI.
 */
export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();

    // Get all unique metrics with their sources and region types
    const { data, error } = await supabase
      .from('market_time_series')
      .select('metric_name, data_source, region_id')
      .order('metric_name');

    if (error) {
      console.error('Error fetching metrics:', error);
      return NextResponse.json(
        { error: 'Failed to fetch metrics', details: error.message },
        { status: 500 }
      );
    }

    // Get region types for each metric
    const { data: regionData, error: regionError } = await supabase
      .from('markets')
      .select('region_id, region_type');

    if (regionError) {
      console.error('Error fetching region types:', regionError);
    }

    // Build region type map
    const regionTypeMap = new Map<string, string>();
    regionData?.forEach((r) => {
      regionTypeMap.set(r.region_id, r.region_type);
    });

    // Group by metric name
    const metricsMap = new Map<
      string,
      { sources: Set<string>; regionTypes: Set<string> }
    >();

    data?.forEach((row) => {
      const regionType = regionTypeMap.get(row.region_id);
      const existing = metricsMap.get(row.metric_name) || {
        sources: new Set<string>(),
        regionTypes: new Set<string>(),
      };

      existing.sources.add(row.data_source);
      if (regionType) {
        existing.regionTypes.add(regionType);
      }

      metricsMap.set(row.metric_name, existing);
    });

    const metrics = Array.from(metricsMap.entries()).map(([name, info]) => ({
      name,
      sources: Array.from(info.sources).sort(),
      region_types: Array.from(info.regionTypes).sort(),
    }));

    // Sort by metric name
    metrics.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      count: metrics.length,
      metrics,
    });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

