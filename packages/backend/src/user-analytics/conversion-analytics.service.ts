import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RedisService } from '../redis/redis.service';
import type {
  ConversionData,
  AnalyticsFilters,
  FunnelStep,
  PaywallMetric,
  FeatureConvMetric,
  TierFlow,
  TierCount,
  Annotation,
} from './user-analytics.types';

const CONVERSION_CACHE_TTL = 600;

@Injectable()
export class ConversionAnalyticsService {
  private readonly logger = new Logger(ConversionAnalyticsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly redis: RedisService,
  ) {}

  async getConversion(days: number, filters: AnalyticsFilters): Promise<ConversionData> {
    const cacheKey = `analytics:conversion:${days}:${JSON.stringify(filters)}`;
    const cached = await this.redis.getByKey(cacheKey);
    if (cached) return cached as ConversionData;

    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [fullFunnel, paywallEffectiveness, featureCorrelation, tierMigration, revenueMetrics, annotations] =
      await Promise.all([
        this.buildFullFunnel(startDate, filters),
        this.buildPaywallEffectiveness(startDate),
        this.buildFeatureCorrelation(startDate),
        this.buildTierMigration(startDate),
        this.buildRevenueMetrics(),
        this.fetchAnnotations(startDate),
      ]);

    const result: ConversionData = {
      fullFunnel,
      customFunnels: [],
      paywallEffectiveness,
      featureCorrelation,
      revenueMetrics,
      tierMigration,
      annotations,
    };

    await this.redis.setByKey(cacheKey, result, CONVERSION_CACHE_TTL);
    return result;
  }

  // ── Full funnel: Visit → Signup → Active → Trial → Paid ──────────────────

  private async buildFullFunnel(startDate: string, filters: AnalyticsFilters): Promise<FunnelStep[]> {
    const client = this.supabase.getClient();
    let sessionQuery = client.from('user_sessions').select('visitor_id').gte('created_at', startDate);
    if (filters.device) sessionQuery = sessionQuery.eq('device_type', filters.device);
    if (filters.source) sessionQuery = sessionQuery.eq('traffic_source', filters.source);

    const conversionEventQuery = (action: string) =>
      client.from('user_events').select('visitor_id').eq('event_action', action).gte('created_at', startDate);

    const [{ data: sessionRows }, { data: signupRows }, { data: trialRows }, { data: paidRows }] =
      await Promise.all([sessionQuery, conversionEventQuery('signup_complete'), conversionEventQuery('trial_start'), conversionEventQuery('upgrade_complete')]);

    const allVisitors = new Set((sessionRows || []).map((r) => r.visitor_id));
    const signupVisitors = new Set((signupRows || []).map((r) => r.visitor_id));
    const trialVisitors = new Set((trialRows || []).map((r) => r.visitor_id));
    const paidVisitors = new Set((paidRows || []).map((r) => r.visitor_id));

    const sessionCountByVisitor: Record<string, number> = {};
    for (const row of sessionRows || []) {
      sessionCountByVisitor[row.visitor_id] = (sessionCountByVisitor[row.visitor_id] || 0) + 1;
    }
    const activeVisitorCount = Object.values(sessionCountByVisitor).filter((c) => c >= 2).length;

    const visitCount = allVisitors.size;
    return this.buildFunnelSteps(visitCount, [
      { name: 'Visit', count: visitCount },
      { name: 'Signup', count: signupVisitors.size },
      { name: 'Active', count: activeVisitorCount },
      { name: 'Trial', count: trialVisitors.size },
      { name: 'Paid', count: paidVisitors.size },
    ]);
  }

  private buildFunnelSteps(firstCount: number, steps: { name: string; count: number }[]): FunnelStep[] {
    return steps.map((step, i) => ({
      name: step.name,
      count: step.count,
      rateFromPrevious: i === 0 || steps[i - 1].count === 0 ? 1 : step.count / steps[i - 1].count,
      rateFromFirst: firstCount > 0 ? step.count / firstCount : 0,
    }));
  }

  // ── Paywall effectiveness: group paywall events by resource ───────────────

  private async buildPaywallEffectiveness(startDate: string): Promise<PaywallMetric[]> {
    const client = this.supabase.getClient();
    const { data: events } = await client
      .from('user_events')
      .select('event_action, event_label')
      .in('event_action', ['paywall_view', 'upgrade_click', 'paywall_dismiss', 'upgrade_complete'])
      .gte('created_at', startDate);

    const byResource: Record<string, { views: number; clicks: number; conversions: number }> = {};
    for (const evt of events || []) {
      const res = evt.event_label || 'unknown';
      if (!byResource[res]) byResource[res] = { views: 0, clicks: 0, conversions: 0 };
      if (evt.event_action === 'paywall_view') byResource[res].views++;
      if (evt.event_action === 'upgrade_click') byResource[res].clicks++;
      if (evt.event_action === 'upgrade_complete') byResource[res].conversions++;
    }

    return Object.entries(byResource).map(([resource, c]) => ({
      resource, views: c.views, clicks: c.clicks,
      ctr: c.views > 0 ? c.clicks / c.views : 0,
      conversions: c.conversions,
    }));
  }

  // ── Feature correlation: first-session feature usage vs conversion ─────────

  private async buildFeatureCorrelation(startDate: string): Promise<FeatureConvMetric[]> {
    const client = this.supabase.getClient();
    const [{ data: allSessions }, { data: conversionEvents }] = await Promise.all([
      client.from('user_sessions').select('visitor_id, id').gte('created_at', startDate).order('created_at', { ascending: true }),
      client.from('user_events').select('visitor_id').eq('event_action', 'upgrade_complete').gte('created_at', startDate),
    ]);

    const firstSessionByVisitor: Record<string, string> = {};
    for (const row of allSessions || []) {
      if (!firstSessionByVisitor[row.visitor_id]) firstSessionByVisitor[row.visitor_id] = row.id;
    }
    const firstSessionIds = Object.values(firstSessionByVisitor);
    if (firstSessionIds.length === 0) return [];

    const { data: featureEvents } = await client
      .from('user_events').select('visitor_id, event_label')
      .eq('event_category', 'feature').in('session_id', firstSessionIds).gte('created_at', startDate);

    const converters = new Set((conversionEvents || []).map((r) => r.visitor_id));
    const totalConverters = converters.size;
    const totalNonConverters = Object.keys(firstSessionByVisitor).length - totalConverters;

    const featureStats: Record<string, { converterUsers: Set<string>; nonConverterUsers: Set<string> }> = {};
    for (const evt of featureEvents || []) {
      const feature = evt.event_label || 'unknown';
      if (!featureStats[feature]) featureStats[feature] = { converterUsers: new Set(), nonConverterUsers: new Set() };
      converters.has(evt.visitor_id)
        ? featureStats[feature].converterUsers.add(evt.visitor_id)
        : featureStats[feature].nonConverterUsers.add(evt.visitor_id);
    }

    return Object.entries(featureStats).map(([feature, stats]) => {
      const converterRate = totalConverters > 0 ? stats.converterUsers.size / totalConverters : 0;
      const nonConverterRate = totalNonConverters > 0 ? stats.nonConverterUsers.size / totalNonConverters : 0;
      return {
        feature, converterRate, nonConverterRate,
        users: stats.converterUsers.size + stats.nonConverterUsers.size,
        signalStrength: converterRate - nonConverterRate,
      };
    });
  }

  // ── Tier migration: derive flows from upgrade_complete event properties ────

  private async buildTierMigration(startDate: string): Promise<TierFlow[]> {
    const client = this.supabase.getClient();
    const { data: events } = await client
      .from('user_events').select('properties')
      .eq('event_action', 'upgrade_complete').gte('created_at', startDate);

    const flowMap: Record<string, number> = {};
    for (const evt of events || []) {
      const props = evt.properties as Record<string, unknown> | null;
      const key = `${(props?.previous_tier as string) || 'free'}|${(props?.current_tier as string) || 'unknown'}`;
      flowMap[key] = (flowMap[key] || 0) + 1;
    }

    return Object.entries(flowMap).map(([key, count]) => {
      const [fromTier, toTier] = key.split('|');
      return { fromTier, toTier, count };
    });
  }

  // ── Revenue metrics: MRR, ARPU, tier distribution ────────────────────────

  private async buildRevenueMetrics(): Promise<{ mrr: number; arpu: number; tierDistribution: TierCount[] }> {
    const client = this.supabase.getClient();
    const [{ data: profileRows }, { data: priceRows }] = await Promise.all([
      client.from('user_profiles').select('subscription_tier').in('subscription_tier', ['pro', 'enterprise']).eq('subscription_status', 'active'),
      client.from('subscription_tiers').select('slug, price_monthly').in('slug', ['pro', 'enterprise']),
    ]);

    const tierPrices: Record<string, number> = {};
    for (const t of priceRows || []) tierPrices[t.slug] = Number(t.price_monthly) || 0;

    const tierCounts: Record<string, number> = {};
    for (const row of profileRows || []) {
      const tier = row.subscription_tier || 'unknown';
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    }

    const tierDistribution: TierCount[] = Object.entries(tierCounts).map(([tier, count]) => ({
      tier, count, revenue: count * (tierPrices[tier] || 0),
    }));

    const mrr = tierDistribution.reduce((sum, t) => sum + t.revenue, 0);
    const totalPaid = tierDistribution.reduce((sum, t) => sum + t.count, 0);
    return { mrr, arpu: totalPaid > 0 ? mrr / totalPaid : 0, tierDistribution };
  }

  // ── Annotations ──────────────────────────────────────────────────────────

  private async fetchAnnotations(startDate: string): Promise<Annotation[]> {
    const client = this.supabase.getClient();
    const { data } = await client
      .from('analytics_annotations').select('id, annotation_date, label, description')
      .gte('annotation_date', startDate).order('annotation_date', { ascending: true });

    return (data || []).map((row) => ({
      id: row.id,
      annotationDate: row.annotation_date,
      label: row.label,
      description: row.description ?? undefined,
    }));
  }
}
