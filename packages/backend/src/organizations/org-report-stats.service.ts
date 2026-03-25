/**
 * Org Report Stats Service
 *
 * Provides report usage statistics for an organization:
 * current month count, previous month count, and per-member breakdown.
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';

@Injectable()
export class OrgReportStatsService {
  private readonly logger = new Logger(OrgReportStatsService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Get report statistics for an organization:
   * - count: reports created this calendar month
   * - previousCount: reports created last calendar month
   * - byMember: per-user breakdown sorted by count descending
   * - limit: report cap (-1 = unlimited)
   */
  async getStats(orgId: string) {
    const now = new Date();
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    ).toISOString();
    const startOfPrevMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1,
    ).toISOString();

    // Current month count
    const { count: currentCount, error: currentError } = await this.supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .gte('created_at', startOfMonth);

    if (currentError) {
      this.logger.warn(
        `Failed to fetch current month report count for org ${orgId}: ${currentError.message}`,
      );
    }

    // Previous month count
    const { count: prevCount, error: prevError } = await this.supabase
      .from('reports')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .gte('created_at', startOfPrevMonth)
      .lt('created_at', startOfMonth);

    if (prevError) {
      this.logger.warn(
        `Failed to fetch previous month report count for org ${orgId}: ${prevError.message}`,
      );
    }

    // Per-member breakdown for current month
    const { data: memberData } = await this.supabase
      .from('reports')
      .select('user_id')
      .eq('organization_id', orgId)
      .gte('created_at', startOfMonth);

    const userCounts = new Map<string, number>();
    (memberData || []).forEach((r) =>
      userCounts.set(r.user_id, (userCounts.get(r.user_id) || 0) + 1),
    );

    const userIds = [...userCounts.keys()];
    const { data: profiles } =
      userIds.length > 0
        ? await this.supabase
            .from('user_profiles')
            .select('id, full_name, email')
            .in('id', userIds)
        : { data: [] };

    const byMember = userIds
      .map((uid) => {
        const profile = (profiles || []).find((p) => p.id === uid);
        return {
          userId: uid,
          name:
            profile?.full_name || profile?.email?.split('@')[0] || 'Unknown',
          count: userCounts.get(uid) || 0,
        };
      })
      .sort((a, b) => b.count - a.count);

    return {
      count: currentCount || 0,
      previousCount: prevCount || 0,
      byMember,
      limit: -1,
    };
  }
}
