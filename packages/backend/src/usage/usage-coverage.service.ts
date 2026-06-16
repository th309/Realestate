import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface CoverageResult {
  usedFeatures: string[];
  mcpConnected: boolean;
}

/**
 * Reads the user's feature-coverage signal: which `feature.*` actions they have
 * fired (from `user_events`) plus whether they hold a live MCP OAuth token.
 * Powers the dashboard "next best move" surface and the onboarding-checklist
 * auto-completion.
 */
@Injectable()
export class UsageCoverageService {
  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Pure: raw feature-event rows + MCP-token flag → deduped coverage. Holds the
   * only non-trivial logic in this service so it can be unit-tested mock-free.
   */
  static toCoverage(
    rows: { event_action: string }[],
    hasMcpToken: boolean,
  ): CoverageResult {
    return {
      usedFeatures: [...new Set(rows.map((r) => r.event_action))],
      mcpConnected: hasMcpToken,
    };
  }

  async getCoverage(userId: string): Promise<CoverageResult> {
    const client = this.supabase.getClient();
    const [{ data: events }, { data: tokens }] = await Promise.all([
      client
        .from('user_events')
        .select('event_action')
        .eq('user_id', userId)
        .eq('event_category', 'feature'),
      client
        .from('mcp_oauth_tokens')
        .select('id')
        .eq('user_id', userId)
        .eq('revoked', false)
        .gt('refresh_expires_at', new Date().toISOString())
        .limit(1),
    ]);
    return UsageCoverageService.toCoverage(
      (events ?? []) as { event_action: string }[],
      (tokens ?? []).length > 0,
    );
  }
}
