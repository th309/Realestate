/**
 * Organization Downgrade Handler Service
 *
 * Handles the full downgrade flow when an enterprise org owner
 * cancels or downgrades their Stripe subscription:
 *
 * 1. Revoke enterprise features (API, embed) on the org
 * 2. Downgrade all non-owner members to free tier
 * 3. Remove non-owner members from the org
 * 4. Update owner's subscription tier
 * 5. Audit log the downgrade
 * 6. Send notification emails (fire-and-forget)
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { OrgAuditService } from '../org-audit/org-audit.service';

@Injectable()
export class OrgDowngradeHandlerService {
  private readonly logger = new Logger(OrgDowngradeHandlerService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly auditService: OrgAuditService,
  ) {}

  /**
   * Execute the full enterprise downgrade flow for an organization.
   *
   * @param orgId - The organization UUID
   * @param newTier - The tier being downgraded to (e.g. 'free', 'pro')
   */
  async handleDowngrade(orgId: string, newTier: string): Promise<void> {
    // 1. Revoke enterprise features on the org
    await this.supabase
      .from('organizations')
      .update({
        api_enabled: false,
        embed_enabled: false,
        billing_status: newTier === 'free' ? 'canceled' : 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', orgId);

    // 2. Get org details + owner
    const { data: org } = await this.supabase
      .from('organizations')
      .select('id, name, owner_id')
      .eq('id', orgId)
      .single();

    if (!org) {
      this.logger.error(`Org ${orgId} not found during downgrade`);
      return;
    }

    // 3. Get all non-owner members
    const { data: members } = await this.supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', orgId)
      .neq('user_id', org.owner_id);

    const memberIds = (members ?? []).map((m) => m.user_id);

    // 4. Downgrade all sub-users to free tier + clear org association
    if (memberIds.length > 0) {
      await this.supabase
        .from('user_profiles')
        .update({
          subscription_tier: 'free',
          organization_id: null,
          organization_role: null,
          updated_at: new Date().toISOString(),
        })
        .in('id', memberIds);

      // 5. Remove members from org
      await this.supabase
        .from('organization_members')
        .delete()
        .eq('organization_id', orgId)
        .neq('user_id', org.owner_id);
    }

    // 6. Update owner tier
    await this.supabase
      .from('user_profiles')
      .update({
        subscription_tier: newTier,
        updated_at: new Date().toISOString(),
      })
      .eq('id', org.owner_id);

    // 7. Audit log
    await this.auditService.log({
      organizationId: orgId,
      actorId: org.owner_id,
      action: 'org_downgraded',
      targetType: 'organization',
      targetId: orgId,
      details: { newTier, membersRemoved: memberIds.length },
    });

    // 8. Queue emails (fire-and-forget — don't block webhook response)
    this.sendDowngradeEmails(org.name, memberIds).catch((err) =>
      this.logger.warn(`Failed to send downgrade emails: ${err}`),
    );

    this.logger.log(
      `Downgraded org ${orgId}: revoked features, freed ${memberIds.length} members, owner tier -> ${newTier}`,
    );
  }

  /**
   * Send notification emails to removed members.
   * Fire-and-forget — failures are logged but never thrown.
   */
  private async sendDowngradeEmails(
    orgName: string,
    memberIds: string[],
  ): Promise<void> {
    if (memberIds.length === 0) return;

    const { data: profiles } = await this.supabase
      .from('user_profiles')
      .select('email, full_name')
      .in('id', memberIds);

    for (const profile of profiles ?? []) {
      // Placeholder — wire to Resend email service when configured
      this.logger.log(
        `[Downgrade Email] To: ${profile.email}, Org: ${orgName}`,
      );
      // TODO: Wire to actual email service when Resend is configured
      // await this.emailService.send({ to: profile.email, subject: '...', html: '...' });
    }
  }
}
