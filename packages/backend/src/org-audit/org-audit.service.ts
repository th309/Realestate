/**
 * Organization Audit Service
 *
 * Logs and queries enterprise organization actions.
 * Writes to the `organization_audit_log` table.
 *
 * CRITICAL: The `log()` method NEVER throws on failure.
 * Audit logging must not break business operations.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';

export type AuditAction =
  | 'org_created'
  | 'org_updated'
  | 'member_invited'
  | 'member_joined'
  | 'member_removed'
  | 'role_changed'
  | 'seats_updated'
  | 'billing_status_changed'
  | 'api_key_created'
  | 'api_key_revoked'
  | 'embed_token_created'
  | 'embed_token_revoked'
  | 'branding_updated'
  | 'logo_uploaded'
  | 'logo_removed'
  | 'ownership_transferred';

export type AuditTargetType =
  | 'organization'
  | 'member'
  | 'invite'
  | 'api_key'
  | 'embed_token'
  | 'branding'
  | 'billing';

export interface AuditLogParams {
  organizationId: string;
  actorId: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId?: string;
  details?: Record<string, unknown>;
}

export interface AuditQueryParams {
  organizationId: string;
  cursor?: string;
  limit?: number;
  action?: AuditAction;
  targetType?: AuditTargetType;
}

export interface AuditEntry {
  id: string;
  organization_id: string;
  actor_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface AuditQueryResult {
  entries: AuditEntry[];
  nextCursor: string | null;
}

const MAX_QUERY_LIMIT = 100;
const DEFAULT_QUERY_LIMIT = 50;

@Injectable()
export class OrgAuditService {
  private readonly logger = new Logger(OrgAuditService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Log an audit action. Never throws — failures are logged and swallowed.
   */
  async log(params: AuditLogParams): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('organization_audit_log')
        .insert({
          organization_id: params.organizationId,
          actor_id: params.actorId,
          action: params.action,
          target_type: params.targetType,
          target_id: params.targetId ?? null,
          details: params.details ?? null,
        });

      if (error) {
        this.logger.error(`Failed to write audit log: ${error.message}`, {
          action: params.action,
          organizationId: params.organizationId,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Unexpected error writing audit log: ${message}`, {
        action: params.action,
        organizationId: params.organizationId,
      });
    }
  }

  /**
   * Query audit log entries with cursor-based pagination.
   * Cursor is the `created_at` ISO timestamp of the last entry returned.
   */
  async query(params: AuditQueryParams): Promise<AuditQueryResult> {
    const limit = Math.min(
      Math.max(params.limit ?? DEFAULT_QUERY_LIMIT, 1),
      MAX_QUERY_LIMIT,
    );

    let query = this.supabase
      .from('organization_audit_log')
      .select('*')
      .eq('organization_id', params.organizationId)
      .order('created_at', { ascending: false })
      .limit(limit + 1); // Fetch one extra to determine if there's a next page

    if (params.cursor) {
      query = query.lt('created_at', params.cursor);
    }

    if (params.action) {
      query = query.eq('action', params.action);
    }

    if (params.targetType) {
      query = query.eq('target_type', params.targetType);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`Failed to query audit log: ${error.message}`, {
        organizationId: params.organizationId,
      });
      return { entries: [], nextCursor: null };
    }

    const rows = (data ?? []) as AuditEntry[];
    const hasMore = rows.length > limit;
    const entries = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore
      ? (entries[entries.length - 1]?.created_at ?? null)
      : null;

    return { entries, nextCursor };
  }
}
