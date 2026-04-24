/**
 * Organization Members Service
 *
 * Handles member lifecycle: listing, removing, role changes, and seat counting.
 * Invite creation is delegated to MemberInviteService.
 * Uses the `invite_org_member` Postgres RPC for atomic seat enforcement.
 */

import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { OrgAuditService } from '../org-audit/org-audit.service';
import { McpEntitlementsInvalidator } from '../entitlements/mcp-entitlements-invalidator.service';
import { MemberInviteService } from './member-invite.service';

@Injectable()
export class MembersService {
  private readonly logger = new Logger(MembersService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly auditService: OrgAuditService,
    private readonly memberInviteService: MemberInviteService,
    private readonly mcpInvalidator: McpEntitlementsInvalidator,
  ) {}

  /**
   * List all active members of an organization, joined with profile data.
   */
  async listMembers(orgId: string) {
    // Query members (no embedded join — PostgREST can't resolve the FK path)
    const { data: members, error } = await this.supabase
      .from('organization_members')
      .select('id, user_id, role, status, created_at')
      .eq('organization_id', orgId)
      .eq('status', 'active');

    if (error) {
      this.logger.error(
        `Failed to list members for org ${orgId}: ${error.message}`,
      );
      throw new Error('Failed to list organization members');
    }

    // Separate query for profile data
    const userIds = (members ?? []).map((m: any) => m.user_id);
    const { data: profiles } =
      userIds.length > 0
        ? await this.supabase
            .from('user_profiles')
            .select('id, email, full_name')
            .in('id', userIds)
        : { data: [] };

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

    // Map to snake_case matching frontend OrgMember type.
    // Sort: admins first, then by created_at ascending (owner is first admin).
    const mapped = (members ?? []).map((row: any) => {
      const profile = profileMap.get(row.user_id);
      return {
        user_id: row.user_id,
        email: profile?.email ?? null,
        display_name:
          profile?.full_name || profile?.email?.split('@')[0] || null,
        role: row.role,
        joined_at: row.created_at,
      };
    });

    return mapped.sort((a: any, b: any) => {
      // Admins first
      if (a.role === 'admin' && b.role !== 'admin') return -1;
      if (a.role !== 'admin' && b.role === 'admin') return 1;
      // Then by join date (oldest first = owner first)
      return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
    });
  }

  /**
   * Invite a new member. Delegated to MemberInviteService.
   */
  inviteMember(orgId: string, email: string, role: string, invitedBy: string) {
    return this.memberInviteService.inviteMember(orgId, email, role, invitedBy);
  }

  /**
   * Remove a member from the organization.
   * Prevents removing the last admin to avoid orphaned orgs.
   * Fires MCP cache invalidation after success — the user's effective tier
   * may drop (enterprise → free) once they're no longer on the org.
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

    // Invalidate MCP cache — user's effective tier just changed
    await this.mcpInvalidator.invalidate([userId]);

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
