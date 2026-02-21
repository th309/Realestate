/**
 * Shared utility for logging per-metric ingestion details
 * Used by both import scripts to record what happened for each metric x geography.
 */

import { SupabaseClient } from '@supabase/supabase-js';

const EXPECTED_REGIONS: Record<string, number> = {
  state: 51,
  metro: 900,
  county: 3200,
  city: 20000,
  zip: 28000,
};

export async function logIngestionDetail(
  supabase: SupabaseClient,
  runId: string,
  metricName: string,
  geography: string,
  status: 'success' | 'failed' | 'skipped',
  recordsInserted: number,
  recordsFailed: number,
  durationMs: number,
  errorMessage?: string,
): Promise<void> {
  let latestDataDate: string | null = null;
  let freshnessDays = 0;
  let coveragePct = 0;
  let recordsDelta = 0;
  let coverageDelta = 0;

  const tableName = `zillow_${geography}`;

  if (status === 'success') {
    try {
      // Get latest date for this metric
      const { data: latestRow } = await supabase
        .from(tableName)
        .select('period_date')
        .eq('metric_name', metricName)
        .order('period_date', { ascending: false })
        .limit(1)
        .single();

      if (latestRow) {
        latestDataDate = latestRow.period_date;
        freshnessDays = Math.floor(
          (Date.now() - new Date(latestRow.period_date).getTime()) / (1000 * 60 * 60 * 24),
        );
      }

      // Get region count for coverage
      const { count: regionCount } = await supabase
        .from(tableName)
        .select('region_id', { count: 'exact', head: true })
        .eq('metric_name', metricName)
        .eq('period_date', latestDataDate || '');

      const expectedRegions = EXPECTED_REGIONS[geography] || 0;
      coveragePct = expectedRegions
        ? Math.min(100, ((regionCount || 0) / expectedRegions) * 100)
        : 0;

      // Compare to previous run for deltas
      const { data: prevDetail } = await supabase
        .from('data_ingestion_details')
        .select('records_inserted, coverage_pct')
        .eq('metric_name', metricName)
        .eq('geography', geography)
        .eq('status', 'success')
        .neq('run_id', runId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (prevDetail) {
        recordsDelta = recordsInserted - (prevDetail.records_inserted || 0);
        coverageDelta = coveragePct - (parseFloat(prevDetail.coverage_pct) || 0);
      }
    } catch {
      // Non-critical: proceed with zeros if freshness/coverage queries fail
    }
  }

  const { error } = await supabase.from('data_ingestion_details').insert({
    run_id: runId,
    metric_name: metricName,
    geography,
    status,
    records_inserted: recordsInserted,
    records_failed: recordsFailed,
    records_delta: recordsDelta,
    periods_added: [],
    latest_data_date: latestDataDate,
    freshness_days: freshnessDays,
    coverage_pct: coveragePct,
    coverage_delta: coverageDelta,
    duration_ms: durationMs,
    error_message: errorMessage || null,
  });

  if (error) {
    console.warn(`Warning: Failed to log ingestion detail for ${metricName}/${geography}: ${error.message}`);
  }
}
