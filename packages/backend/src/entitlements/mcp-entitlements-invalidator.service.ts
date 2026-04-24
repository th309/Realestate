import { Injectable, Inject, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';

/**
 * Fires best-effort invalidation calls to the mcp-server's in-memory
 * entitlements cache. Called by backend mutation sites (billing webhooks,
 * org-billing webhooks, invite accept, member remove) whenever a user's
 * effective entitlement could have changed.
 *
 * Failure is non-fatal: the mcp-server has a 30 s negative-result TTL
 * that guarantees correctness within that window even if invalidation
 * never lands.
 */
@Injectable()
export class McpEntitlementsInvalidator {
  private readonly logger = new Logger(McpEntitlementsInvalidator.name);
  private readonly url =
    process.env.MCP_SERVER_URL ?? 'https://mcp.propertyiq.app';

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  async invalidate(userIds: string[]): Promise<void> {
    const secret = process.env.MCP_INTERNAL_SECRET;
    if (!secret || userIds.length === 0) return;

    try {
      await fetch(`${this.url}/internal/entitlements/invalidate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userIds }),
        signal: AbortSignal.timeout(3000),
      });
    } catch (err) {
      this.logger.warn(
        `MCP invalidate failed (best-effort): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async invalidateOrgMembers(orgId: string): Promise<void> {
    const userIds = await this.getActiveMemberIds(orgId);
    await this.invalidate(userIds);
  }

  private async getActiveMemberIds(orgId: string): Promise<string[]> {
    const { data } = await this.supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', orgId)
      .eq('status', 'active');
    return (data ?? []).map((m: any) => m.user_id);
  }
}
