import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { IngestableEvent } from './user-analytics.types';
import { classifySessionAtInsert } from './bot-detection';
import {
  buildSessionUpdatePlan,
  type ExistingSessionRow,
} from './session-update-payload';

@Injectable()
export class SessionManagerService {
  private readonly logger = new Logger(SessionManagerService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async upsertSession(
    sessionId: string,
    events: IngestableEvent[],
    clientUserAgent = '',
    isRetry = false,
  ): Promise<void> {
    const client = this.supabase.getClient();

    const { data: existing, error: selectError } = await client
      .from('user_sessions')
      .select(
        'session_id, page_count, feature_events_count, landing_page, entry_type, referrer, referrer_domain, utm_source, utm_medium, utm_campaign, is_bot',
      )
      .eq('session_id', sessionId)
      .maybeSingle();

    if (selectError) {
      this.logger.error(
        `Failed to query session ${sessionId}: ${selectError.message}`,
      );
      return;
    }

    const pageviewEvents = events.filter(
      (e) => e.event_category === 'pageview',
    );
    const pageviewCount = pageviewEvents.length;
    const firstEvent = events[0];
    const lastEvent = events[events.length - 1];
    const props = (firstEvent?.properties ?? {}) as Record<
      string,
      string | undefined
    >;

    const landingPage =
      pageviewEvents[0]?.page_path ?? firstEvent?.page_path ?? null;
    const exitPage = lastEvent?.page_path ?? null;

    // Only a completed signup counts. The `conversion` category also carries
    // funnel-progress events (pricing_page_view, signup_start), so keying on the
    // category alone would mark browsers as converted. Matches the
    // signup_complete trigger used for identity stitching.
    const conversionEvent = events.find(
      (e) => e.event_action === 'signup_complete',
    );

    if (!existing) {
      const { error: insertError } = await client.from('user_sessions').insert({
        session_id: sessionId,
        visitor_id: firstEvent?.visitor_id ?? null,
        user_id: firstEvent?.user_id ?? null,
        // Default matches the events table, which writes 'anonymous' rather
        // than null. Without it every session had a null tier and the
        // dashboard's Tier filter matched nothing.
        user_tier: firstEvent?.user_tier ?? 'anonymous',
        started_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
        landing_page: landingPage,
        exit_page: exitPage,
        page_count: pageviewCount,
        is_bounce: pageviewCount <= 1,
        converted: !!conversionEvent,
        conversion_type: conversionEvent?.event_action ?? null,
        // `true` for a self-identifying crawler, otherwise NULL — never false.
        // false means "human, on evidence", and nothing observable at insert
        // supplies that: duration is 0 for everyone at creation. Writing false
        // here is what re-contaminated the human segment within hours of the
        // backfill. Promotion to false happens below, once the session earns it.
        is_bot: classifySessionAtInsert(clientUserAgent),
        device_type: props['device_type'] ?? null,
        screen_width: props['screen_width']
          ? Number(props['screen_width'])
          : null,
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
        // A concurrent batch for the same new session can win the insert: both
        // callers read `existing === null`, both insert, and the loser hits the
        // session_id primary key. Previously that batch was logged and dropped,
        // losing its pageviews and feature counts even though its events landed
        // in user_events. Re-run once so the row is found and merged through the
        // update path instead. 23505 is the Postgres unique-violation code.
        if (insertError.code === '23505' && !isRetry) {
          // Logged so the frequency of this race — and the attribution
          // backfill it triggers below — is measurable rather than theoretical.
          this.logger.warn(
            `Concurrent insert for session ${sessionId}; merging via update path`,
          );
          return this.upsertSession(sessionId, events, clientUserAgent, true);
        }
        this.logger.error(
          `Failed to insert session ${sessionId}: ${insertError.message}`,
        );
      }
      return;
    }

    const { payload: cleanPayload, promotesToHuman } = buildSessionUpdatePlan({
      existing: existing as unknown as ExistingSessionRow,
      events,
      pageviewCount,
      exitPage,
      props,
    });

    const { error: updateError } = await client
      .from('user_sessions')
      .update(cleanPayload)
      .eq('session_id', sessionId);

    if (updateError) {
      this.logger.error(
        `Failed to update session ${sessionId}: ${updateError.message}`,
      );
    }

    // Mirror the verdict onto the session's events. They carry a denormalised
    // copy because the event panels query user_events directly and PostgREST
    // cannot express the join; without this, a promoted human's events stay
    // NULL and drop out of the human segment while their session appears in it.
    // Fires once per session, on the promotion batch only.
    if (promotesToHuman) {
      const { error: mirrorError } = await client
        .from('user_events')
        .update({ is_bot: false })
        .eq('session_id', sessionId)
        .is('is_bot', null);

      if (mirrorError) {
        this.logger.error(
          `Failed to mirror classification onto events for ${sessionId}: ${mirrorError.message}`,
        );
      }
    }
  }

  /**
   * Record a keepalive ping.
   *
   * Also increments `heartbeat_count`, which previously was never written by
   * anything — it sat at 0 on every session, so engagement readouts derived
   * from it were uniformly empty.
   *
   * Read-modify-write rather than an atomic increment, matching upsertSession.
   * A lost update under concurrent pings from multiple tabs only undercounts a
   * coarse engagement signal, so the added round trip is not worth an RPC.
   */
  async updateHeartbeat(sessionId: string): Promise<void> {
    const client = this.supabase.getClient();

    const { data: existing } = await client
      .from('user_sessions')
      .select('heartbeat_count, is_bot')
      .eq('session_id', sessionId)
      .maybeSingle();

    const nextCount = (existing?.heartbeat_count ?? 0) + 1;

    // A SECOND heartbeat is human evidence. The first fires at
    // EARLY_HEARTBEAT_MS (5s), which crawlers reach too because they block on
    // network-idle — 2,019 sessions sit at exactly 5s for that reason. Surviving
    // to the 30s cadence is what a one-shot crawler never does.
    // Promote only from NULL, so a UA-flagged crawler is never rewritten.
    const payload: Record<string, unknown> = {
      last_activity_at: new Date().toISOString(),
      heartbeat_count: nextCount,
    };
    if (nextCount > 1 && existing?.is_bot === null) {
      payload.is_bot = false;
    }

    const { error } = await client
      .from('user_sessions')
      .update(payload)
      .eq('session_id', sessionId);

    if (error) {
      this.logger.error(
        `Heartbeat update failed for session ${sessionId}: ${error.message}`,
      );
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
      this.logger.error(
        `Failed to query stale sessions: ${selectError.message}`,
      );
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
