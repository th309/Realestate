/**
 * Growth Progress Service
 *
 * Reads the active growth goal from the database, computes current
 * paid user count, growth rate, days remaining, and milestone
 * statuses. Returns a fully typed GrowthProgress object with no
 * LLM involvement — purely data-driven.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { GrowthProgress, MilestoneStatus } from './ai-insights.types';

@Injectable()
export class GrowthProgressService {
  private readonly logger = new Logger(GrowthProgressService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async getGrowthProgress(): Promise<GrowthProgress> {
    const client = this.supabase.getClient();

    const { data: goal, error } = await client
      .from('growth_goals')
      .select('*')
      .eq('is_active', true)
      .single();

    if (error) {
      this.logger.error(
        `Failed to query growth_goals: ${error.message} (code: ${error.code})`,
      );
    }

    if (!goal) {
      return this.emptyGrowthProgress();
    }

    // Exclude admin users and test accounts from paid user counts —
    // admins and internal testers are not real customers.
    const excludedUserIds = await this.getExcludedUserIds(client);

    let paidQuery = client
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .in('subscription_tier', ['pro', 'enterprise'])
      .eq('subscription_status', 'active');

    if (excludedUserIds.length > 0) {
      paidQuery = paidQuery.not('id', 'in', `(${excludedUserIds.join(',')})`);
    }

    const { count: paidUsers } = await paidQuery;

    const currentPaidUsers = paidUsers || 0;
    const now = new Date();
    const startDate = new Date(goal.start_date);
    const targetDate = new Date(goal.target_date);
    const msPerDay = 1000 * 60 * 60 * 24;

    const daysElapsed = Math.max(
      1,
      Math.ceil((now.getTime() - startDate.getTime()) / msPerDay),
    );
    const daysRemaining = Math.max(
      0,
      Math.ceil((targetDate.getTime() - now.getTime()) / msPerDay),
    );
    const totalDays = Math.max(
      1,
      Math.ceil((targetDate.getTime() - startDate.getTime()) / msPerDay),
    );

    // Growth rate based on entire period since start date, not just last 30d
    const currentGrowthRate = currentPaidUsers / daysElapsed;
    const usersNeeded = goal.target_paid_users - currentPaidUsers;
    const requiredGrowthRate =
      daysRemaining > 0 ? usersNeeded / daysRemaining : 0;

    const milestoneProgress: MilestoneStatus[] = (goal.milestones || []).map(
      (m: { target: number; label: string }) => {
        const reached = currentPaidUsers >= m.target;
        let projectedDate: string | undefined;
        if (!reached && currentGrowthRate > 0) {
          const daysToReach = (m.target - currentPaidUsers) / currentGrowthRate;
          projectedDate = new Date(
            now.getTime() + daysToReach * 24 * 60 * 60 * 1000,
          ).toISOString();
        }
        return { target: m.target, label: m.label, reached, projectedDate };
      },
    );

    return {
      goal: {
        id: goal.id,
        name: goal.name,
        targetPaidUsers: goal.target_paid_users,
        startDate: goal.start_date,
        targetDate: goal.target_date,
        milestones: goal.milestones,
        isActive: goal.is_active,
      },
      currentPaidUsers,
      daysElapsed,
      daysRemaining,
      totalDays,
      currentGrowthRate: Math.round(currentGrowthRate * 100) / 100,
      requiredGrowthRate: Math.round(requiredGrowthRate * 100) / 100,
      milestoneProgress,
    };
  }

  /**
   * Returns user IDs that should be excluded from paid user counts:
   * admin users (founders/staff) and explicitly flagged test accounts.
   */
  private async getExcludedUserIds(
    client: ReturnType<SupabaseService['getClient']>,
  ): Promise<string[]> {
    const ids = new Set<string>();

    // Exclude all admin users (super_admin, admin)
    const { data: admins } = await client.from('admin_users').select('id');

    if (admins) {
      for (const admin of admins) {
        ids.add(admin.id);
      }
    }

    return Array.from(ids);
  }

  private emptyGrowthProgress(): GrowthProgress {
    return {
      goal: {
        id: '',
        name: 'No active goal',
        targetPaidUsers: 0,
        startDate: '',
        targetDate: '',
        milestones: [],
        isActive: false,
      },
      currentPaidUsers: 0,
      daysElapsed: 0,
      daysRemaining: 0,
      totalDays: 0,
      currentGrowthRate: 0,
      requiredGrowthRate: 0,
      milestoneProgress: [],
    };
  }
}
