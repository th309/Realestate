import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { IngestableEvent } from './user-analytics.types';

@Injectable()
export class SessionManagerService {
  private readonly logger = new Logger(SessionManagerService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async upsertSession(sessionId: string, events: IngestableEvent[]): Promise<void> {
    const client = this.supabase.getClient();

    const { data: existing, error: selectError } = await client
      .from('user_sessions')
      .select('session_id, page_count, feature_events_count')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (selectError) {
      this.logger.error(`Failed to query session ${sessionId}: ${selectError.message}`);
      return;
    }

    const pageviewEvents = events.filter((e) => e.event_category === 'pageview');
    const pageviewCount = pageviewEvents.length;
    const firstEvent = events[0];
    const lastEvent = events[events.length - 1];
    const props = (firstEvent?.properties ?? {}) as Record<string, string | undefined>;

    const landingPage =
      pageviewEvents[0]?.page_path ?? firstEvent?.page_path ?? null;
    const exitPage = lastEvent?.page_path ?? null;

    if (!existing) {
      const { error: insertError } = await client.from('user_sessions').insert({
        session_id: sessionId,
        visitor_id: firstEvent?.visitor_id ?? null,
        user_id: firstEvent?.user_id ?? null,
        user_tier: firstEvent?.user_tier ?? null,
        started_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
        landing_page: landingPage,
        exit_page: exitPage,
        page_count: pageviewCount,
        is_bounce: pageviewCount <= 1,
        device_type: props['device_type'] ?? null,
        screen_width: props['screen_width'] ? Number(props['screen_width']) : null,
        browser: props['browser'] ?? null,
        os: props['os'] ?? null,
        referrer: props['referrer'] ?? null,
        referrer_domain: props['referrer_domain'] ?? null,
        utm_source: props['utm_source'] ?? null,
        utm_medium: props['utm_medium'] ?? null,
        utm_campaign: props['utm_campaign'] ?? null,
        entry_type: props['entry_type'] ?? null,
      });

      if (insertError) {
        this.logger.error(`Failed to insert session ${sessionId}: ${insertError.message}`);
      }
      return;
    }

    const previousPageCount = existing.page_count ?? 0;
    const previousFeatureCount = existing.feature_events_count ?? 0;
    const newFeatureCount = events.filter((e) => e.event_category === 'feature').length;
    const hasFrustration = events.some((e) => e.event_category === 'frustration');
    const totalPageCount = previousPageCount + pageviewCount;

    const updatePayload: Record<string, unknown> = {
      last_activity_at: new Date().toISOString(),
      exit_page: exitPage,
      page_count: totalPageCount,
      is_bounce: totalPageCount <= 1 ? undefined : false,
      feature_events_count: previousFeatureCount + newFeatureCount,
    };

    if (hasFrustration) {
      updatePayload['had_frustration_event'] = true;
    }

    // Remove undefined fields so Supabase does not overwrite with null
    const cleanPayload = Object.fromEntries(
      Object.entries(updatePayload).filter(([, v]) => v !== undefined),
    );

    const { error: updateError } = await client
      .from('user_sessions')
      .update(cleanPayload)
      .eq('session_id', sessionId);

    if (updateError) {
      this.logger.error(`Failed to update session ${sessionId}: ${updateError.message}`);
    }
  }

  async updateHeartbeat(sessionId: string): Promise<void> {
    const client = this.supabase.getClient();

    const { error } = await client
      .from('user_sessions')
      .update({ last_activity_at: new Date().toISOString() })
      .eq('session_id', sessionId);

    if (error) {
      this.logger.error(`Heartbeat update failed for session ${sessionId}: ${error.message}`);
    }
  }

  async closeStaleSessions(): Promise<void> {
    const client = this.supabase.getClient();
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { data: staleSessions, error: selectError } = await client
      .from('user_sessions')
      .select('session_id, started_at, last_activity_at')
      .lt('last_activity_at', thirtyMinAgo)
      .eq('duration_seconds', 0)
      .limit(500);

    if (selectError) {
      this.logger.error(`Failed to query stale sessions: ${selectError.message}`);
      return;
    }

    if (!staleSessions?.length) return;

    for (const session of staleSessions) {
      const start = new Date(session.started_at).getTime();
      const end = new Date(session.last_activity_at).getTime();
      const durationSeconds = Math.round((end - start) / 1000);

      const { error: updateError } = await client
        .from('user_sessions')
        .update({ duration_seconds: durationSeconds })
        .eq('session_id', session.session_id);

      if (updateError) {
        this.logger.warn(
          `Failed to close stale session ${session.session_id}: ${updateError.message}`,
        );
      }
    }

    this.logger.log(`Closed ${staleSessions.length} stale sessions`);
  }
}
