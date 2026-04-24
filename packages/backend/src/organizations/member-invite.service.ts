/**
 * Member Invite Service
 *
 * Handles the invite-creation flow: calls the `invite_org_member` Postgres
 * RPC for atomic seat enforcement, then dispatches the invite email.
 * Extracted from MembersService to keep that file within the 300-line limit.
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
export class MemberInviteService {
  private readonly logger = new Logger(MemberInviteService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly auditService: OrgAuditService,
    private readonly inviteEmailService: InviteEmailService,
  ) {}

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
}
