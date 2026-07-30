/**
 * Query helpers for the Conversion tab's secondary panels.
 *
 * Extracted from conversion-analytics.service.ts, which passed the 300-line
 * hard limit once these were repaired. Standalone functions over a
 * SupabaseClient, matching the existing acquisition-session-queries.ts and
 * journey-panel-queries.ts pattern.
 *
 * Every panel here was returning empty before this pass, each for its own
 * reason — see the individual notes. None of the causes was bot traffic.
 */

import { Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  PaywallMetric,
  FeatureConvMetric,
  TierFlow,
  TierCount,
  Annotation,
} from './user-analytics.types';

const logger = new Logger('ConversionPanelQueries');

/**
 * Coerce an RPC value to a usable number.
 *
 * PostgREST returns numerics as quoted strings, and a bare `Number()` turns
 * anything unparseable into NaN — which then propagates through Math.max in the
 * renderer and blanks every row, not just the bad one. This is the boundary
 * between the database and the UI, so it validates rather than assumes.
 */
function finite(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Upgrade-gate effectiveness.
 *
 * Was grouping on `event_label`, which is NULL on every paywall event, so every
 * row collapsed into a single bucket labelled "unknown". The gate identity was
 * in `properties` the whole time (feature / trigger / geoLevel) with page_path
 * as a fallback; analytics_paywall_effectiveness resolves it there.
 *
 * Dev surfaces are excluded by default — /dev-paywalls carried 14 events per
 * variant against 1-3 for the real gates, so a test harness looked like the
 * site's dominant conversion surface.
 */
export async function queryPaywallEffectiveness(
  client: SupabaseClient,
  startDate: string,
  traffic: string = 'human',
): Promise<PaywallMetric[]> {
  const { data, error } = await client.rpc('analytics_paywall_effectiveness', {
    p_start: startDate,
    p_end: null,
    p_traffic: traffic,
    p_include_dev: false,
  });

  if (error) {
    logger.error(`Paywall effectiveness rpc failed: ${error.message}`);
    return [];
  }

  return ((data ?? []) as Record<string, any>[]).map(
    (row): PaywallMetric => ({
      gate: row.gate,
      surface: row.surface,
      views: finite(row.views),
      viewers: finite(row.viewers),
      ctaClicks: finite(row.cta_clicks),
      // null, not 0, when nothing was gated: 0/0 is undefined and a "0.0%"
      // click-through reads as the worst-performing gate on the page.
      ctr: finite(row.views) > 0 ? finite(row.ctr) : null,
    }),
  );
}

/**
 * "Of the people who used this feature, how many signed up?"
 *
 * The old implementation compared share-of-converters against
 * share-of-non-converters over FIRST sessions only, and selected `id` from
 * user_sessions — a column that does not exist — so it returned [] on every
 * single load since it shipped.
 *
 * Attribution is per visitor across the window, not per session: the feature use
 * and the signup are routinely in different sessions, and requiring them in one
 * would undercount every returning visitor.
 */
export async function queryFeatureCorrelation(
  client: SupabaseClient,
  startDate: string,
  traffic: string = 'human',
): Promise<FeatureConvMetric[]> {
  const { data, error } = await client.rpc('analytics_feature_conversion', {
    p_start: startDate,
    p_end: null,
    p_traffic: traffic,
    p_min_users: 1,
  });

  if (error) {
    logger.error(`Feature conversion rpc failed: ${error.message}`);
    return [];
  }

  return ((data ?? []) as Record<string, any>[]).map(
    (row): FeatureConvMetric => ({
      feature: row.feature,
      users: finite(row.users),
      converted: finite(row.converted),
      // A single NaN here blanks EVERY bar in the panel, because the render
      // divides by Math.max(...allRates) and Math.max propagates NaN.
      conversionRate: finite(row.conversion_rate),
      baselineRate: finite(row.baseline_rate),
      lift:
        row.lift === null || row.lift === undefined
          ? null
          : finite(row.lift),
    }),
  );
}

/**
 * Tier-to-tier movement.
 *
 * NO DATA SOURCE EXISTS. This read `upgrade_complete` event properties for
 * `previous_tier`/`current_tier`; that event has never been emitted, and there
 * is no tier-change audit table to derive flows from either — `user_profiles`
 * holds only the CURRENT tier, with no history.
 *
 * Returning an empty array is therefore the honest answer, not a bug to chase.
 * The current-tier breakdown that IS real is already served by
 * `queryRevenueMetrics().tierDistribution`, so the flow panel should be dropped
 * from the UI rather than left rendering an empty diagram.
 */
export function queryTierMigration(): TierFlow[] {
  return [];
}

export async function queryConversionAnnotations(
  client: SupabaseClient,
  startDate: string,
): Promise<Annotation[]> {
  const { data, error } = await client
    .from('analytics_annotations')
    .select('id, annotation_date, label, description')
    .gte('annotation_date', startDate)
    .order('annotation_date', { ascending: true });

  if (error) {
    logger.warn(`Annotations query failed: ${error.message}`);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    annotationDate: row.annotation_date,
    label: row.label,
    description: row.description ?? undefined,
  }));
}
