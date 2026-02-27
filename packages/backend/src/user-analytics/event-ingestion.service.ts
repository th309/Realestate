import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { SessionManagerService } from './session-manager.service';
import { IdentityStitchingService } from './identity-stitching.service';
import type { IngestableEvent, IngestionResult } from './user-analytics.types';

@Injectable()
export class EventIngestionService {
  private readonly logger = new Logger(EventIngestionService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly sessionManager: SessionManagerService,
    private readonly identityStitching: IdentityStitchingService,
  ) {}

  async ingestBatch(rawEvents: unknown[]): Promise<IngestionResult> {
    const { valid, rejected } = this.validateEvents(rawEvents);
    if (valid.length === 0) return { accepted: 0, rejected: rejected };

    // Separate heartbeats from regular events
    const heartbeats = valid.filter((e) => e.event_category === 'heartbeat');
    const regular = valid.filter((e) => e.event_category !== 'heartbeat');

    // Process heartbeats — lightweight session keepalive
    const uniqueHeartbeatSessions = [
      ...new Set(heartbeats.map((e) => e.session_id)),
    ];
    await Promise.all(
      uniqueHeartbeatSessions.map((sid) =>
        this.sessionManager.updateHeartbeat(sid),
      ),
    );

    // Insert regular events into user_events
    if (regular.length > 0) {
      const client = this.supabase.getClient();
      const rows = regular.map((e) => ({
        client_event_id: e.client_event_id || null,
        visitor_id: e.visitor_id,
        session_id: e.session_id,
        user_id: e.user_id || null,
        user_tier: e.user_tier || 'anonymous',
        event_category: e.event_category,
        event_action: e.event_action,
        event_label: e.event_label || null,
        numeric_value: e.numeric_value ?? null,
        page_path: e.page_path || null,
        previous_page_path: e.previous_page_path || null,
        properties: e.properties || {},
        created_at: e.timestamp || new Date().toISOString(),
      }));

      const { error } = await client.from('user_events').upsert(rows, {
        onConflict: 'session_id,client_event_id',
        ignoreDuplicates: true,
      });

      if (error) {
        this.logger.error(`Failed to insert events: ${error.message}`);
      }

      // Upsert sessions for each unique session_id
      const sessionGroups = this.groupBySession(regular);
      await Promise.all(
        Object.entries(sessionGroups).map(([sid, events]) =>
          this.sessionManager.upsertSession(sid, events),
        ),
      );

      // Check for signup_complete events → trigger identity stitching
      await this.handleIdentityStitching(regular);
    }

    return { accepted: valid.length, rejected };
  }

  private validateEvents(rawEvents: unknown[]): {
    valid: IngestableEvent[];
    rejected: number;
  } {
    let rejected = 0;
    const valid: IngestableEvent[] = [];

    for (const raw of rawEvents) {
      if (!raw || typeof raw !== 'object') {
        rejected++;
        continue;
      }
      const e = raw as Record<string, unknown>;
      // Map event_type/event_name to event_category/event_action for backwards compat
      const category = (e.event_category || e.event_type) as string | undefined;
      const action = (e.event_action || e.event_name) as string | undefined;
      const visitorId = e.visitor_id as string | undefined;
      const sessionId = e.session_id as string | undefined;

      if (!category || !action || !sessionId) {
        rejected++;
        continue;
      }

      valid.push({
        client_event_id: e.client_event_id as string | undefined,
        visitor_id: visitorId || sessionId,
        session_id: sessionId,
        user_id: e.user_id as string | undefined,
        user_tier: e.user_tier as string | undefined,
        event_category: category,
        event_action: action,
        event_label: e.event_label as string | undefined,
        numeric_value: e.numeric_value as number | undefined,
        page_path: e.page_path as string | undefined,
        previous_page_path: e.previous_page_path as string | undefined,
        properties: e.properties as Record<string, unknown> | undefined,
        timestamp: e.timestamp as string | undefined,
      });
    }
    return { valid, rejected };
  }

  private groupBySession(
    events: IngestableEvent[],
  ): Record<string, IngestableEvent[]> {
    const groups: Record<string, IngestableEvent[]> = {};
    for (const e of events) {
      if (!groups[e.session_id]) groups[e.session_id] = [];
      groups[e.session_id].push(e);
    }
    return groups;
  }

  private async handleIdentityStitching(
    events: IngestableEvent[],
  ): Promise<void> {
    const signupEvents = events.filter(
      (e) =>
        e.event_category === 'conversion' &&
        e.event_action === 'signup_complete',
    );
    for (const evt of signupEvents) {
      if (evt.visitor_id && evt.user_id) {
        await this.identityStitching.linkVisitorToUser(
          evt.visitor_id,
          evt.user_id,
        );
      }
    }
  }
}
