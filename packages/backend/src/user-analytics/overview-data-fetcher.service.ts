import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  AnalyticsFilters,
  FunnelStep,
  PageMetric,
  Annotation,
} from './user-analytics.types';

const FUNNEL_STAGES: { name: string; eventAction: string | null }[] = [
  { name: 'Visited', eventAction: null },
  { name: 'Signed Up', eventAction: 'signup' },
  { name: 'Activated', eventAction: 'activation' },
  { name: 'Converted', eventAction: 'subscription_started' },
];

@Injectable()
export class OverviewDataFetcherService {
  private readonly logger = new Logger(OverviewDataFetcherService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async fetchSessionRows(
    startDate: Date,
    endDate: Date | null,
    fields: string,
    filters: AnalyticsFilters,
  ): Promise<any[]> {
    const client = this.supabase.getClient();
    let query = client
      .from('user_sessions')
      .select(fields)
      .gte('started_at', startDate.toISOString());

    if (endDate) {
      query = query.lt('started_at', endDate.toISOString());
    }

    if (filters.tier) query = (query as any).eq('user_tier', filters.tier);
    if (filters.device)
      query = (query as any).eq('device_type', filters.device);

    const { data, error } = await (query as any);
    if (error) {
      this.logger.error(
        `[OverviewDataFetcher] Session query error: ${error.message}`,
      );
      return [];
    }
    return data ?? [];
  }

  async fetchTopPages(
    startDate: Date,
    filters: AnalyticsFilters,
  ): Promise<PageMetric[]> {
    const client = this.supabase.getClient();
    let query = client
      .from('user_events')
      .select('page_path')
      .eq('event_category', 'pageview')
      .gte('created_at', startDate.toISOString())
      .not('page_path', 'is', null);

    if (filters.tier) query = query.eq('user_tier', filters.tier);
    if (filters.device) query = query.eq('device_type', filters.device);

    const { data, error } = await query;
    if (error) {
      this.logger.error(
        `[OverviewDataFetcher] Top pages query error: ${error.message}`,
      );
      return [];
    }

    const counts: Record<string, number> = {};
    for (const row of data ?? []) {
      const path = row.page_path as string;
      counts[path] = (counts[path] ?? 0) + 1;
    }

    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(
        ([pagePath, views]): PageMetric => ({
          pagePath,
          views,
          bounceRate: 0,
          avgTimeSeconds: 0,
          conversionRate: 0,
        }),
      );
  }

  async fetchQuickFunnelStageCounts(
    startDate: Date,
    filters: AnalyticsFilters,
  ): Promise<FunnelStep[]> {
    const client = this.supabase.getClient();
    const iso = startDate.toISOString();
    const stageCounts: number[] = [];

    for (const stage of FUNNEL_STAGES) {
      if (stage.eventAction === null) {
        const rows = await this.fetchSessionRows(
          startDate,
          null,
          'visitor_id',
          filters,
        );
        stageCounts.push(
          new Set(rows.map((r) => r.visitor_id).filter(Boolean)).size,
        );
      } else {
        let query = client
          .from('user_events')
          .select('visitor_id')
          .gte('created_at', iso)
          .eq('event_action', stage.eventAction);

        if (filters.tier) query = query.eq('user_tier', filters.tier);
        if (filters.device) query = query.eq('device_type', filters.device);

        const { data, error } = await query;
        if (error) {
          this.logger.error(
            `[OverviewDataFetcher] Funnel stage error: ${error.message}`,
          );
          stageCounts.push(0);
        } else {
          stageCounts.push(
            new Set((data ?? []).map((r: any) => r.visitor_id).filter(Boolean))
              .size,
          );
        }
      }
    }

    return FUNNEL_STAGES.map(
      (stage, i): FunnelStep => ({
        name: stage.name,
        count: stageCounts[i],
        rateFromPrevious:
          i === 0 || stageCounts[i - 1] === 0
            ? 1
            : stageCounts[i] / stageCounts[i - 1],
        rateFromFirst:
          stageCounts[0] === 0 ? 0 : stageCounts[i] / stageCounts[0],
      }),
    );
  }

  async fetchAnnotations(startDate: Date): Promise<Annotation[]> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('analytics_annotations')
      .select('id,annotation_date,label,description')
      .gte('annotation_date', startDate.toISOString().slice(0, 10))
      .order('annotation_date', { ascending: true });

    if (error) {
      this.logger.error(
        `[OverviewDataFetcher] Annotations query error: ${error.message}`,
      );
      return [];
    }

    return (data ?? []).map(
      (row: any): Annotation => ({
        id: row.id,
        annotationDate: row.annotation_date,
        label: row.label,
        description: row.description ?? undefined,
      }),
    );
  }
}
