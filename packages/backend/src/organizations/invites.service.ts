/**
 * Organization Invites Service
 *
 * Handles invite token validation and acceptance flow.
 * Separated from MembersService to keep each file focused.
 */

import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { OrgAuditService } from '../org-audit/org-audit.service';

@Injectable()
export class InvitesService {
  private readonly logger = new Logger(InvitesService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly auditService: OrgAuditService,
  ) {}

  /**
   * Look up an invite by its token, joined with org name for the accept page.
   */
  async getInviteByToken(token: string) {
    const { data: invite, error } = await this.supabase
      .from('organization_invites')
      .select(
        'id, email, role, status, expires_at, organization_id, organizations(name, slug)',
      )
      .eq('token', token)
      .single();

    if (error || !invite) {
      throw new NotFoundException('Invite not found or has been revoked');
    }

    const org = invite.organizations as any;

    return {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      status: invite.status,
      expiresAt: invite.expires_at,
      organizationId: invite.organization_id,
      orgName: org?.name ?? null,
      orgSlug: org?.slug ?? null,
    };
  }

  /**
   * Accept a pending invite: validate state, create membership, update invite.
   * Returns the org slug for frontend redirect.
   */
  async acceptInvite(token: string, userId: string): Promise<string> {
    const invite = await this.getInviteByToken(token);

    // Validate invite state
    if (invite.status !== 'pending') {
      throw new BadRequestException({
        code: 'INVITE_NOT_PENDING',
        message: `This invite has already been ${invite.status}.`,
      });
    }

    if (new Date(invite.expiresAt) < new Date()) {
      throw new BadRequestException({
        code: 'INVITE_EXPIRED',
        message: 'This invite has expired. Please request a new one.',
      });
    }

    // Verify the accepting user's email matches the invite email
    const { data: userProfile } = await this.supabase
      .from('user_profiles')
      .select('email')
      .eq('id', userId)
      .single();

    if (
      !userProfile?.email ||
      userProfile.email.toLowerCase() !== invite.email.toLowerCase()
    ) {
      throw new BadRequestException({
        code: 'EMAIL_MISMATCH',
        message: 'This invite was sent to a different email address.',
      });
    }

    // Check user is not already in another organization
    const { data: existingMembership } = await this.supabase
      .from('organization_members')
      .select('id, organization_id')
      .eq('user_id', userId)
      .in('status', ['pending', 'active'])
      .maybeSingle();

    if (existingMembership) {
      throw new BadRequestException({
        code: 'ALREADY_IN_ORG',
        message:
          'You are already a member of an organization. Leave your current organization first.',
      });
    }

    // Create the membership row
    const { error: memberError } = await this.supabase
      .from('organization_members')
      .insert({
        organization_id: invite.organizationId,
        user_id: userId,
        role: invite.role,
        status: 'active',
        joined_at: new Date().toISOString(),
      });

    if (memberError) {
      this.logger.error(
        `Failed to create membership for invite ${invite.id}: ${memberError.message}`,
      );
      throw new BadRequestException('Failed to join organization');
    }

    try {
      // Mark invite as accepted
      await this.supabase
        .from('organization_invites')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', invite.id);

      // Link user profile to the organization
      await this.supabase
        .from('user_profiles')
        .update({ organization_id: invite.organizationId })
        .eq('id', userId);
    } catch (err) {
      // Rollback: delete the member row to maintain consistency
      this.logger.error(
        `Partial failure accepting invite ${invite.id}, rolling back membership: ${err}`,
      );
      await this.supabase
        .from('organization_members')
        .delete()
        .eq('organization_id', invite.organizationId)
        .eq('user_id', userId);
      throw new BadRequestException('Failed to complete invite acceptance');
    }

    await this.auditService.log({
      organizationId: invite.organizationId,
      actorId: userId,
      action: 'member_joined',
      targetType: 'member',
      targetId: userId,
      details: { inviteId: invite.id, role: invite.role },
    });

    return invite.orgSlug!;
  }
}
