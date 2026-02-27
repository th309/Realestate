import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class IdentityStitchingService {
  private readonly logger = new Logger(IdentityStitchingService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async linkVisitorToUser(visitorId: string, userId: string): Promise<void> {
    const client = this.supabase.getClient();

    const { data: earliest } = await client
      .from('user_sessions')
      .select('started_at, entry_type, utm_source')
      .eq('visitor_id', visitorId)
      .order('started_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    const { data: allSessions } = await client
      .from('user_sessions')
      .select('session_id')
      .eq('visitor_id', visitorId);
    const count = allSessions?.length ?? 0;

    const acquisitionSource =
      earliest?.utm_source || earliest?.entry_type || 'direct';

    await client.from('visitor_identities').upsert(
      {
        visitor_id: visitorId,
        user_id: userId,
        first_seen_at: earliest?.started_at || new Date().toISOString(),
        identified_at: new Date().toISOString(),
        sessions_before_identification: count || 0,
        signup_cohort: new Date().toISOString().split('T')[0],
        acquisition_source: acquisitionSource,
      },
      { onConflict: 'visitor_id,user_id' },
    );

    const { data: updatedSessions } = await client
      .from('user_sessions')
      .update({ user_id: userId })
      .eq('visitor_id', visitorId)
      .is('user_id', null)
      .select('session_id');
    const sessionCount = updatedSessions?.length ?? 0;

    const { data: updatedEvents } = await client
      .from('user_events')
      .update({ user_id: userId })
      .eq('visitor_id', visitorId)
      .is('user_id', null)
      .select('id');
    const eventCount = updatedEvents?.length ?? 0;

    this.logger.log(
      `Linked visitor ${visitorId} to user ${userId}: ` +
        `backfilled ${sessionCount || 0} sessions, ${eventCount || 0} events`,
    );

    if ((eventCount || 0) > 10000) {
      this.logger.warn(
        `Large backfill for visitor ${visitorId}: ${eventCount} events updated. ` +
          `Consider batching future backfills to avoid lock contention.`,
      );
    }
  }
}
