import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import {
  AnalyticsFilters,
  FunnelStep,
  PageMetric,
  Annotation,
  TrafficSegmentCounts,
} from './user-analytics.types';
import { DEFAULT_TRAFFIC_SEGMENT } from './traffic-segment';

/**
 * Overview reads go through SQL aggregate functions, never through
 * `.select()` + aggregate-in-JS.
 *
 * The previous implementation fetched session rows and reduced them in Node.
 * PostgREST caps an unranged `.select()` at 1,000 rows without erroring, so
 * every KPI was a correct calculation over a truncated population — the
 * dashboard's "1,000 TOTAL SESSIONS" was the cap itself, against ~48,000 real
 * sessions in the same window. Aggregating server-side removes the failure mode
 * rather than raising the ceiling: there is no array left to truncate.
 */

/**
 * The signup funnel, defined against events that ACTUALLY EXIST.
 *
 * The previous stages matched `signup`, `activation` and `subscription_started`
 * — none of which has ever been emitted, so stages 2-4 read 0 forever and the
 * panel showed a 100% drop-off that described nothing. Verified against the
 * live inventory of 41 distinct (category, action) pairs in user_events.
 *
 * Stage 3 is the one that makes the funnel diagnostic: it splits an abandoned
 * signup by PATH, so "typed an email and gave up" stops being indistinguishable
 * from "clicked Google and it broke".
 */
export const SIGNUP_FUNNEL_STAGES: {
  name: string;
  actions: string[] | null;
}[] = [
  { name: 'Visited', actions: null },
  { name: 'Opened signup', actions: ['signup_start'] },
  {
    name: 'Engaged a path',
    actions: ['signup_email_engaged', 'signup_oauth_click'],
  },
  { name: 'Code sent', actions: ['signup_pending_confirmation'] },
  { name: 'Code verified', actions: ['signup_otp_verified'] },
  { name: 'Account created', actions: ['signup_complete'] },
];

export interface OverviewKpiRow {
  unique_visitors: number;
  total_sessions: number;
  avg_session_duration: number;
  bounce_rate: number;
  pages_per_session: number;
  converted_visitors: number;
  conversion_rate: number;
}

export interface DailyPoint {
  day: string;
  visitors: number;
  sessions: number;
  avg_duration: number;
  bounce_rate: number;
  pages_per_session: number;
}

@Injectable()
export class OverviewDataFetcherService {
  private readonly logger = new Logger(OverviewDataFetcherService.name);

  constructor(private readonly supabase: SupabaseService) {}

  private segment(filters: AnalyticsFilters): string {
    return filters.traffic ?? DEFAULT_TRAFFIC_SEGMENT;
  }

  async fetchKpis(
    startDate: Date,
    endDate: Date | null,
    filters: AnalyticsFilters,
  ): Promise<OverviewKpiRow | null> {
    const { data, error } = await this.supabase
      .getClient()
      .rpc('analytics_overview_kpis', {
        p_start: startDate.toISOString(),
        p_end: endDate ? endDate.toISOString() : null,
        p_traffic: this.segment(filters),
        p_tier: filters.tier ?? null,
        p_device: filters.device ?? null,
      });

    if (error) {
      this.logger.error(
        `[OverviewDataFetcher] KPI rpc failed: ${error.message}`,
      );
      return null;
    }
    return (data?.[0] as OverviewKpiRow | undefined) ?? null;
  }

  async fetchDailySeries(
    startDate: Date,
    filters: AnalyticsFilters,
  ): Promise<DailyPoint[]> {
    const { data, error } = await this.supabase
      .getClient()
      .rpc('analytics_daily_visitors', {
        p_start: startDate.toISOString(),
        p_end: null,
        p_traffic: this.segment(filters),
        p_tier: filters.tier ?? null,
      });

    if (error) {
      this.logger.error(
        `[OverviewDataFetcher] Daily series rpc failed: ${error.message}`,
      );
      return [];
    }
    return (data ?? []) as DailyPoint[];
  }

  /**
   * How much traffic sits in each classification. Surfaced in the UI so an
   * excluded population is stated rather than silently dropped — a corrected
   * number is indistinguishable from a broken one unless you say what was
   * removed.
   */
  async fetchTrafficSegments(
    startDate: Date,
    endDate: Date | null,
  ): Promise<TrafficSegmentCounts> {
    const { data, error } = await this.supabase
      .getClient()
      .rpc('analytics_traffic_segments', {
        p_start: startDate.toISOString(),
        p_end: endDate ? endDate.toISOString() : null,
      });

    if (error) {
      this.logger.error(
        `[OverviewDataFetcher] Traffic segments rpc failed: ${error.message}`,
      );
      return { human: 0, bot: 0, unclassified: 0, internal: 0, total: 0 };
    }
    const row = data?.[0] as TrafficSegmentCounts | undefined;
    return row ?? { human: 0, bot: 0, unclassified: 0, internal: 0, total: 0 };
  }

  async fetchTopPages(
    startDate: Date,
    filters: AnalyticsFilters,
  ): Promise<PageMetric[]> {
    // analytics_page_performance (not analytics_top_pages, which only ever
    // returns page_path/views/visitors) joins each pageview back to its
    // session, so bounce rate, avg session time and signups ARE measurable
    // per page. bounce_rate is null when nobody entered on that page (no
    // sessions to compute a bounce rate over) — Number(null) is 0, which
    // would silently reintroduce the fake "0%" this table used to show, so
    // every field below is explicitly `== null ? undefined : Number(...)`.
    const { data, error } = await this.supabase
      .getClient()
      .rpc('analytics_page_performance', {
        p_start: startDate.toISOString(),
        p_end: null,
        p_traffic: this.segment(filters),
        p_tier: filters.tier ?? null,
        p_limit: 10,
      });

    if (error) {
      this.logger.error(
        `[OverviewDataFetcher] Top pages rpc failed: ${error.message}`,
      );
      return [];
    }

    return (data ?? []).map((row: any): PageMetric => {
      const visitors = Number(row.visitors);
      const signups = row.signups == null ? null : Number(row.signups);
      return {
        pagePath: row.page_path,
        views: Number(row.views),
        visitors,
        bounceRate:
          row.bounce_rate == null ? undefined : Number(row.bounce_rate),
        avgTimeSeconds:
          row.avg_session_seconds == null
            ? undefined
            : Number(row.avg_session_seconds),
        // Visitor-scoped, matching the overview KPI's own conversion-rate
        // convention (converted visitors / unique visitors). `signups` counts
        // distinct SESSIONS with a signup that included this page, so a
        // visitor converting across two sessions is double-counted — an
        // acceptable approximation for a top-10 page breakdown.
        conversionRate:
          signups === null || visitors === 0 ? undefined : signups / visitors,
      };
    });
  }

  async fetchQuickFunnelStageCounts(
    startDate: Date,
    filters: AnalyticsFilters,
  ): Promise<FunnelStep[]> {
    const client = this.supabase.getClient();
    const traffic = this.segment(filters);

    const allActions = SIGNUP_FUNNEL_STAGES.flatMap((s) => s.actions ?? []);

    const [kpis, counts] = await Promise.all([
      this.fetchKpis(startDate, null, filters),
      client.rpc('analytics_event_visitor_counts', {
        p_start: startDate.toISOString(),
        p_actions: allActions,
        p_end: null,
        p_traffic: traffic,
        p_tier: filters.tier ?? null,
      }),
    ]);

    if (counts.error) {
      this.logger.error(
        `[OverviewDataFetcher] Funnel rpc failed: ${counts.error.message}`,
      );
      return [];
    }

    const visitorsByAction = new Map<string, number>();
    for (const row of (counts.data ?? []) as any[]) {
      visitorsByAction.set(row.event_action, Number(row.visitors));
    }

    // A stage with several actions is an OR (either path counts), so take the
    // max rather than the sum — summing would double-count a visitor who tried
    // both the email form and the Google button.
    const stageCounts = SIGNUP_FUNNEL_STAGES.map((stage) => {
      if (stage.actions === null) return kpis?.unique_visitors ?? 0;
      return Math.max(
        0,
        ...stage.actions.map((a) => visitorsByAction.get(a) ?? 0),
      );
    });

    return SIGNUP_FUNNEL_STAGES.map(
      (stage, i): FunnelStep => ({
        name: stage.name,
        count: stageCounts[i],
        rateFromPrevious:
          i === 0
            ? 1
            : stageCounts[i - 1] === 0
              ? 0
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
