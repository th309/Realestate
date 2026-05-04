import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { RedisTourCacheService } from './redis-tour-cache.service';
import { SupabaseService } from '../supabase/supabase.service';

export interface ClaimInput {
  sessionId: string;
  userId: string;
}

export interface ClaimResult {
  reportId: string;
}

/**
 * Claims an anonymous tour session into a permanent `reports` row owned by
 * `userId`. Uses Redis as the source of truth for the anonymous session, then
 * promotes it into Supabase atomically (insert report → upsert profile →
 * mark Redis claimed). Returns null when the session is missing (e.g.
 * expired); throws ConflictException if a *different* user already claimed
 * the same session.
 */
@Injectable()
export class ListingPresentationClaimService {
  private readonly logger = new Logger(ListingPresentationClaimService.name);

  constructor(
    private readonly cache: RedisTourCacheService,
    private readonly supabase: SupabaseService,
  ) {}

  async claim(input: ClaimInput): Promise<ClaimResult | null> {
    const session = await this.cache.get(input.sessionId);
    if (!session) return null;

    if (session.claimedBy && session.claimedBy !== input.userId) {
      throw new ConflictException(
        'Tour session already claimed by another user',
      );
    }

    const { data, error } = await this.supabase
      .from('reports')
      .insert({
        user_id: input.userId,
        report_type: 'listing_presentation',
        market_geo_level: session.market.geoLevel,
        market_geo_id: session.market.geoId,
        market_name: session.market.name,
        payload: session.reportPayload,
        is_demo: false,
        source: 'tour_anonymous_claim',
        anon_session_id: session.sessionId,
      })
      .select('id');

    if (error || !data?.[0]) {
      this.logger.error(`Failed to insert claimed report: ${error?.message}`);
      throw new Error(
        `Failed to insert report: ${error?.message ?? 'unknown'}`,
      );
    }

    // Set onboarding_market for the activation funnel + dashboard.
    const { error: profileError } = await this.supabase
      .from('user_profiles')
      .upsert(
        { id: input.userId, onboarding_market: session.market },
        { onConflict: 'id' },
      );
    if (profileError) {
      this.logger.warn(
        `Failed to upsert onboarding_market for ${input.userId}: ${profileError.message}`,
      );
    }

    await this.cache.markClaimed(session.sessionId, input.userId);

    return { reportId: data[0].id as string };
  }
}
