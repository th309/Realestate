/**
 * Query helpers for the Conversion tab's secondary panels.
 *
 * Extracted from conversion-analytics.service.ts, which passed the 300-line
 * hard limit once these were repaired. Standalone functions over a
 * SupabaseClient, matching the existing acquisition-session-queries.ts and
 * journey-outbound-queries.ts pattern.
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
 * Upgrade-gate effectiveness.
 *
 * Was matching `event_action` values `paywall_view`, `upgrade_click`,
 * `paywall_dismiss` and `upgrade_complete`. The real paywall event is category
 * `paywall` / action `view`; the other three have never been emitted. So the
 * `.in()` selected nothing and the panel rendered empty on every load.
 */
export async function queryPaywallEffectiveness(
  client: SupabaseClient,
  startDate: string,
): Promise<PaywallMetric[]> {
  const { data: events, error } = await client
    .from('user_events')
    .select('event_category, event_action, event_label')
    .or(
      'and(event_category.eq.paywall,event_action.eq.view),' +
        'event_action.in.(upgrade_prompt_shown,pricing_cta_click,market_limit_hit)',
    )
    .is('is_bot', false)
    .gte('created_at', startDate);

  if (error) {
    logger.error(`Paywall query failed: ${error.message}`);
    return [];
  }

  const byResource: Record<
    string,
    { views: number; clicks: number; conversions: number }
  > = {};

  for (const evt of events ?? []) {
    const res = evt.event_label || 'unknown';
    byResource[res] ??= { views: 0, clicks: 0, conversions: 0 };

    const isGate =
      (evt.event_category === 'paywall' && evt.event_action === 'view') ||
      evt.event_action === 'upgrade_prompt_shown' ||
      evt.event_action === 'market_limit_hit';

    if (isGate) byResource[res].views++;
    if (evt.event_action === 'pricing_cta_click') byResource[res].clicks++;
  }

  return Object.entries(byResource).map(([resource, c]) => ({
    resource,
    views: c.views,
    clicks: c.clicks,
    ctr: c.views > 0 ? c.clicks / c.views : 0,
    conversions: c.conversions,
  }));
}

/**
 * Which first-session features correlate with signing up.
 *
 * Was selecting `id` from user_sessions. That column does not exist — the
 * primary key is `session_id` — so PostgREST returned 42703, the error was
 * destructured away, and the panel returned [] every single time since it
 * shipped. It also keyed conversion on `upgrade_complete`, which has never
 * fired; `signup_complete` is the only conversion event that exists.
 */
export async function queryFeatureCorrelation(
  client: SupabaseClient,
  startDate: string,
): Promise<FeatureConvMetric[]> {
  const [
    { data: allSessions, error: sessionsError },
    { data: conversionEvents, error: conversionError },
  ] = await Promise.all([
    client
      .from('user_sessions')
      .select('visitor_id, session_id')
      .is('is_bot', false)
      .gte('started_at', startDate)
      .order('started_at', { ascending: true }),
    client
      .from('user_events')
      .select('visitor_id')
      .eq('event_action', 'signup_complete')
      .is('is_bot', false)
      .gte('created_at', startDate),
  ]);

  if (sessionsError || conversionError) {
    logger.error(
      `Feature correlation query failed: ${
        sessionsError?.message ?? conversionError?.message
      }`,
    );
    return [];
  }

  const firstSessionByVisitor: Record<string, string> = {};
  for (const row of allSessions ?? []) {
    firstSessionByVisitor[row.visitor_id] ??= row.session_id;
  }

  const firstSessionIds = Object.values(firstSessionByVisitor);
  if (firstSessionIds.length === 0) return [];

  const { data: featureEvents, error: featureError } = await client
    .from('user_events')
    .select('visitor_id, event_label')
    .eq('event_category', 'feature')
    .is('is_bot', false)
    .in('session_id', firstSessionIds.slice(0, 500))
    .gte('created_at', startDate);

  if (featureError) {
    logger.error(`Feature events query failed: ${featureError.message}`);
    return [];
  }

  const converters = new Set((conversionEvents ?? []).map((r) => r.visitor_id));
  const totalConverters = converters.size;
  const totalNonConverters =
    Object.keys(firstSessionByVisitor).length - totalConverters;

  const featureStats: Record<
    string,
    { converterUsers: Set<string>; nonConverterUsers: Set<string> }
  > = {};

  for (const evt of featureEvents ?? []) {
    const feature = evt.event_label || 'unknown';
    featureStats[feature] ??= {
      converterUsers: new Set(),
      nonConverterUsers: new Set(),
    };
    if (converters.has(evt.visitor_id)) {
      featureStats[feature].converterUsers.add(evt.visitor_id);
    } else {
      featureStats[feature].nonConverterUsers.add(evt.visitor_id);
    }
  }

  return Object.entries(featureStats).map(([feature, stats]) => {
    const converterRate =
      totalConverters > 0 ? stats.converterUsers.size / totalConverters : 0;
    const nonConverterRate =
      totalNonConverters > 0
        ? stats.nonConverterUsers.size / totalNonConverters
        : 0;
    return {
      feature,
      converterRate,
      nonConverterRate,
      users: stats.converterUsers.size + stats.nonConverterUsers.size,
      signalStrength: converterRate - nonConverterRate,
    };
  });
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

/** MRR / ARPU / tier split. Genuinely sourced — profiles joined to tier prices. */
export async function queryRevenueMetrics(client: SupabaseClient): Promise<{
  mrr: number;
  arpu: number;
  tierDistribution: TierCount[];
}> {
  const [{ data: profileRows }, { data: priceRows }] = await Promise.all([
    client
      .from('user_profiles')
      .select('subscription_tier')
      .in('subscription_tier', ['pro', 'enterprise'])
      .eq('subscription_status', 'active'),
    client
      .from('subscription_tiers')
      .select('slug, price_monthly')
      .in('slug', ['pro', 'enterprise']),
  ]);

  const tierPrices: Record<string, number> = {};
  for (const t of priceRows ?? []) {
    tierPrices[t.slug] = Number(t.price_monthly) || 0;
  }

  const tierCounts: Record<string, number> = {};
  for (const row of profileRows ?? []) {
    const tier = row.subscription_tier || 'unknown';
    tierCounts[tier] = (tierCounts[tier] || 0) + 1;
  }

  const tierDistribution: TierCount[] = Object.entries(tierCounts).map(
    ([tier, count]) => ({
      tier,
      count,
      revenue: count * (tierPrices[tier] || 0),
    }),
  );

  const mrr = tierDistribution.reduce((sum, t) => sum + t.revenue, 0);
  const totalPaid = tierDistribution.reduce((sum, t) => sum + t.count, 0);

  return { mrr, arpu: totalPaid > 0 ? mrr / totalPaid : 0, tierDistribution };
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
