/**
 * Enterprise Grace Period Service
 *
 * Manages the 30-day billing grace window for enterprise users.
 * When a site admin upgrades a user to enterprise, they get 30 days
 * to set up Stripe billing. After 30 days without billing, they're
 * auto-downgraded to free.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface GraceStatusResponse {
  hasGracePeriod: boolean;
  expiresAt: string | null;
  daysRemaining: number;
  hasBilling: boolean;
}

@Injectable()
export class EnterpriseGraceService {
  private readonly logger = new Logger(EnterpriseGraceService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Get the enterprise grace period status for a user.
   *
   * Side effect: if the user already has billing set up
   * (stripe_customer_id is present), clear the grace period
   * since it's no longer needed.
   */
  async getGraceStatus(userId: string): Promise<GraceStatusResponse> {
    const client = this.supabase.getClient();

    const { data: profile } = await client
      .from('user_profiles')
      .select('enterprise_grace_expires_at, stripe_customer_id')
      .eq('id', userId)
      .single();

    if (!profile) {
      return {
        hasGracePeriod: false,
        expiresAt: null,
        daysRemaining: 0,
        hasBilling: false,
      };
    }

    const hasBilling = !!profile.stripe_customer_id;
    const graceExpiresAt = profile.enterprise_grace_expires_at;

    // If billing is set up, clear the grace period — it's no longer needed
    if (hasBilling && graceExpiresAt) {
      await client
        .from('user_profiles')
        .update({
          enterprise_grace_expires_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      this.logger.log(
        `Cleared enterprise grace period for user ${userId} — billing is active`,
      );

      return {
        hasGracePeriod: false,
        expiresAt: null,
        daysRemaining: 0,
        hasBilling: true,
      };
    }

    // Check if grace period is active
    const now = new Date();
    const hasGracePeriod = !!graceExpiresAt && new Date(graceExpiresAt) > now;

    const daysRemaining = hasGracePeriod
      ? Math.ceil(
          (new Date(graceExpiresAt).getTime() - now.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;

    return {
      hasGracePeriod,
      expiresAt: graceExpiresAt || null,
      daysRemaining,
      hasBilling,
    };
  }
}
