/**
 * Paywall Analytics Service
 *
 * Aggregates and queries paywall_events for admin analytics.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

export interface PaywallStats {
  paywallViews: number;
  upgradeClicks: number;
  conversionRate: number;
  topBlockedResources: Array<{
    resource_type: string;
    resource_id: string;
    views: number;
    clicks: number;
    ctr: number;
  }>;
  eventsByTier: Record<string, { views: number; clicks: number }>;
  trendsLast7Days: Array<{
    date: string;
    views: number;
    clicks: number;
  }>;
}

export interface PaywallEvent {
  id: string;
  user_id: string | null;
  session_id: string | null;
  resource_type: string;
  resource_id: string;
  user_tier: string;
  page_path: string | null;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

@Injectable()
export class PaywallAnalyticsService {
  private readonly logger = new Logger(PaywallAnalyticsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Get aggregated paywall statistics
   */
  async getStats(options?: {
    startDate?: string;
    endDate?: string;
  }): Promise<PaywallStats> {
    const client = this.supabase.getClient();
    const endDate = options?.endDate || new Date().toISOString();
    const startDate = options?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Get total views and clicks
    const { data: viewsData } = await client
      .from('paywall_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'view')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    const { data: clicksData, count: clicksCount } = await client
      .from('paywall_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'click_upgrade')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    const { count: viewsCount } = await client
      .from('paywall_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'view')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    const paywallViews = viewsCount || 0;
    const upgradeClicks = clicksCount || 0;
    const conversionRate = paywallViews > 0 ? (upgradeClicks / paywallViews) * 100 : 0;

    // Get top blocked resources
    const { data: resourceData } = await client
      .from('paywall_events')
      .select('resource_type, resource_id, event_type')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    const resourceStats: Record<string, { views: number; clicks: number }> = {};
    for (const event of resourceData || []) {
      const key = `${event.resource_type}:${event.resource_id}`;
      if (!resourceStats[key]) {
        resourceStats[key] = { views: 0, clicks: 0 };
      }
      if (event.event_type === 'view') {
        resourceStats[key].views++;
      } else if (event.event_type === 'click_upgrade') {
        resourceStats[key].clicks++;
      }
    }

    const topBlockedResources = Object.entries(resourceStats)
      .map(([key, stats]) => {
        const [resource_type, resource_id] = key.split(':');
        return {
          resource_type,
          resource_id,
          views: stats.views,
          clicks: stats.clicks,
          ctr: stats.views > 0 ? (stats.clicks / stats.views) * 100 : 0,
        };
      })
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    // Get events by tier
    const { data: tierData } = await client
      .from('paywall_events')
      .select('user_tier, event_type')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    const eventsByTier: Record<string, { views: number; clicks: number }> = {};
    for (const event of tierData || []) {
      const tier = event.user_tier || 'free';
      if (!eventsByTier[tier]) {
        eventsByTier[tier] = { views: 0, clicks: 0 };
      }
      if (event.event_type === 'view') {
        eventsByTier[tier].views++;
      } else if (event.event_type === 'click_upgrade') {
        eventsByTier[tier].clicks++;
      }
    }

    // Get trends for last 7 days
    const trends: Array<{ date: string; views: number; clicks: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const { count: dayViews } = await client
        .from('paywall_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'view')
        .gte('created_at', dateStr)
        .lt('created_at', nextDate.toISOString().split('T')[0]);

      const { count: dayClicks } = await client
        .from('paywall_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'click_upgrade')
        .gte('created_at', dateStr)
        .lt('created_at', nextDate.toISOString().split('T')[0]);

      trends.push({
        date: dateStr,
        views: dayViews || 0,
        clicks: dayClicks || 0,
      });
    }

    return {
      paywallViews,
      upgradeClicks,
      conversionRate,
      topBlockedResources,
      eventsByTier,
      trendsLast7Days: trends,
    };
  }

  /**
   * Get recent paywall events
   */
  async getRecentEvents(options?: {
    limit?: number;
    offset?: number;
    eventType?: string;
    resourceType?: string;
  }): Promise<{ events: PaywallEvent[]; total: number }> {
    const client = this.supabase.getClient();

    let query = client
      .from('paywall_events')
      .select('*', { count: 'exact' });

    if (options?.eventType) {
      query = query.eq('event_type', options.eventType);
    }
    if (options?.resourceType) {
      query = query.eq('resource_type', options.resourceType);
    }

    query = query
      .order('created_at', { ascending: false })
      .limit(options?.limit || 50);

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return { events: data || [], total: count || 0 };
  }

  /**
   * Get funnel analysis (view -> click -> convert)
   */
  async getFunnelData(options?: {
    startDate?: string;
    endDate?: string;
  }): Promise<{
    views: number;
    clicks: number;
    conversions: number;
    viewToClickRate: number;
    clickToConvertRate: number;
    overallRate: number;
  }> {
    const client = this.supabase.getClient();
    const endDate = options?.endDate || new Date().toISOString();
    const startDate = options?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { count: views } = await client
      .from('paywall_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'view')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    const { count: clicks } = await client
      .from('paywall_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'click_upgrade')
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    // For conversions, we count trials that were started via paywall
    const { count: conversions } = await client
      .from('user_trials')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate)
      .lte('created_at', endDate);

    const viewCount = views || 0;
    const clickCount = clicks || 0;
    const conversionCount = conversions || 0;

    return {
      views: viewCount,
      clicks: clickCount,
      conversions: conversionCount,
      viewToClickRate: viewCount > 0 ? (clickCount / viewCount) * 100 : 0,
      clickToConvertRate: clickCount > 0 ? (conversionCount / clickCount) * 100 : 0,
      overallRate: viewCount > 0 ? (conversionCount / viewCount) * 100 : 0,
    };
  }
}
