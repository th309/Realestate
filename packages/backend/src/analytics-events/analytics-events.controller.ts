import { Controller, Post, Body, Headers, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';

interface AnalyticsEvent {
  event_type: string;
  event_name: string;
  properties?: Record<string, unknown>;
  user_tier?: string;
  page_path?: string;
  session_id?: string;
  timestamp?: string;
}

@Controller('api/analytics/events')
export class AnalyticsEventsController {
  private readonly logger = new Logger(AnalyticsEventsController.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  @Post()
  async trackEvents(
    @Headers('x-user-id') userId: string | undefined,
    @Headers('x-session-id') sessionId: string | undefined,
    @Body() body: { events: AnalyticsEvent[] },
  ) {
    const events = body.events;
    if (!events?.length) {
      return { success: true, count: 0 };
    }

    // Cap at 100 events per batch
    const batch = events.slice(0, 100);

    const rows = batch.map((event) => ({
      user_id: userId || null,
      session_id: event.session_id || sessionId || null,
      event_type: event.event_type,
      event_name: event.event_name,
      properties: event.properties || {},
      user_tier: event.user_tier || null,
      page_path: event.page_path || null,
      created_at: event.timestamp || new Date().toISOString(),
    }));

    const { error } = await this.supabase.from('analytics_events').insert(rows);

    if (error) {
      this.logger.error('Failed to insert analytics events:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true, count: rows.length };
  }
}
