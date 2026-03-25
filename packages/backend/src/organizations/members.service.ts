/**
 * Organization Members Service
 *
 * Handles member lifecycle: listing, inviting, removing, and role changes.
 * Uses the `invite_org_member` Postgres RPC for atomic seat enforcement.
 * Delegates email delivery to InviteEmailService.
 */

import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { OrgAuditService } from '../org-audit/org-audit.service';
import { InviteEmailService } from './invite-email.service';

@Injectable()
export class MembersService {
  private readonly logger = new Logger(MembersService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly auditService: OrgAuditService,
    private readonly inviteEmailService: InviteEmailService,
  ) {}

  /**
   * List all active members of an organization, joined with profile data.
   */
  async listMembers(orgId: string) {
    const { data, error } = await this.supabase
      .from('organization_members')
      .select(
        'id, user_id, role, status, created_at, user_profiles(email, full_name)',
      )
      .eq('organization_id', orgId)
      .eq('status', 'active');

    if (error) {
      this.logger.error(
        `Failed to list members for org ${orgId}: ${error.message}`,
      );
      throw new Error('Failed to list organization members');
    }

    return (data ?? []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      email: row.user_profiles?.email ?? null,
      name: row.user_profiles?.full_name ?? null,
      role: row.role,
      status: row.status,
      joinedAt: row.created_at,
    }));
  }

  /**
   * Invite a new member via the `invite_org_member` Postgres RPC.
   * The RPC atomically checks seat limits before inserting.
   */
  async inviteMember(
    orgId: string,
    email: string,
    role: string,
    invitedBy: string,
  ) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { data, error } = await this.supabase.rpc('invite_org_member', {
      p_org_id: orgId,
      p_email: email,
      p_role: role,
      p_token: token,
      p_invited_by: invitedBy,
      p_expires_at: expiresAt,
    });

    if (error) {
      this.logger.error(`invite_org_member RPC failed: ${error.message}`);

      if (error.message?.includes('seat_limit')) {
        throw new BadRequestException({
          code: 'SEAT_LIMIT_REACHED',
          message:
            'Organization has reached its seat limit. Upgrade your plan or remove members.',
        });
      }
      if (error.message?.includes('already')) {
        throw new BadRequestException({
          code: 'ALREADY_INVITED',
          message: 'This email has already been invited to this organization.',
        });
      }

      throw new Error('Failed to create invite');
    }

    // Fetch org name for the invite email
    const { data: org } = await this.supabase
      .from('organizations')
      .select('name')
      .eq('id', orgId)
      .single();

    const orgName = org?.name ?? 'your organization';

    let emailSent = true;
    try {
      await this.inviteEmailService.sendInviteEmail(email, orgName, token);
    } catch (err) {
      this.logger.error(
        `Failed to send invite email to ${email}: ${(err as Error).message}`,
      );
      emailSent = false;
    }

    await this.auditService.log({
      organizationId: orgId,
      actorId: invitedBy,
      action: 'member_invited',
      targetType: 'invite',
      targetId: data,
      details: { email, role },
    });

    return { id: data, email, role, expiresAt, emailSent };
  }

  /**
   * Remove a member from the organization.
   * Prevents removing the last admin to avoid orphaned orgs.
   */
  async removeMember(orgId: string, userId: string, actorId: string) {
    // Check if the target is an admin and if they're the last one
    const { data: targetMember } = await this.supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (!targetMember) {
      throw new BadRequestException('Member not found in this organization');
    }

    if (targetMember.role === 'admin') {
      await this.assertNotLastAdmin(orgId);
    }

    // Hard delete from organization_members
    const { error: deleteError } = await this.supabase
      .from('organization_members')
      .delete()
      .eq('organization_id', orgId)
      .eq('user_id', userId);

    if (deleteError) {
      this.logger.error(
        `Failed to remove member ${userId} from org ${orgId}: ${deleteError.message}`,
      );
      throw new Error('Failed to remove member');
    }

    // Clear organization_id on the user profile
    await this.supabase
      .from('user_profiles')
      .update({ organization_id: null })
      .eq('id', userId);

    await this.auditService.log({
      organizationId: orgId,
      actorId,
      action: 'member_removed',
      targetType: 'member',
      targetId: userId,
    });
  }

  /**
   * Change a member's role (admin <-> member).
   * Prevents demoting the last admin.
   */
  async changeRole(
    orgId: string,
    userId: string,
    newRole: string,
    actorId: string,
  ) {
    // If demoting from admin, verify not the last admin
    const { data: currentMember } = await this.supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (!currentMember) {
      throw new BadRequestException('Member not found in this organization');
    }

    if (currentMember.role === 'admin' && newRole !== 'admin') {
      await this.assertNotLastAdmin(orgId);
    }

    const { error } = await this.supabase
      .from('organization_members')
      .update({ role: newRole })
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .eq('status', 'active');

    if (error) {
      this.logger.error(
        `Failed to change role for ${userId} in org ${orgId}: ${error.message}`,
      );
      throw new Error('Failed to change member role');
    }

    await this.auditService.log({
      organizationId: orgId,
      actorId,
      action: 'role_changed',
      targetType: 'member',
      targetId: userId,
      details: {
        previousRole: currentMember.role,
        newRole,
      },
    });
  }

  /**
   * Count active members in the organization (used by billing for seat enforcement).
   */
  async getMemberCount(orgId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'active');

    if (error) {
      this.logger.error(
        `Failed to count members for org ${orgId}: ${error.message}`,
      );
      return 0;
    }

    return count ?? 0;
  }

  /**
   * Throw BadRequestException if the org has only one admin remaining.
   */
  private async assertNotLastAdmin(orgId: string): Promise<void> {
    const { count } = await this.supabase
      .from('organization_members')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('role', 'admin')
      .eq('status', 'active');

    if ((count ?? 0) <= 1) {
      throw new BadRequestException({
        code: 'LAST_ADMIN',
        message:
          'Cannot remove or demote the last admin. Promote another member to admin first.',
      });
    }
  }
}
