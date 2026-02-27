/**
 * Growth Progress Service
 *
 * Reads the active growth goal from the database, computes current
 * paid user count, growth rate, days remaining, and milestone
 * statuses. Returns a fully typed GrowthProgress object with no
 * LLM involvement — purely data-driven.
 */

import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { GrowthProgress, MilestoneStatus } from './ai-insights.types';

@Injectable()
export class GrowthProgressService {
  constructor(private readonly supabase: SupabaseService) {}

  async getGrowthProgress(): Promise<GrowthProgress> {
    const client = this.supabase.getClient();

    const { data: goal } = await client
      .from('growth_goals')
      .select('*')
      .eq('is_active', true)
      .single();

    if (!goal) {
      return this.emptyGrowthProgress();
    }

    const { count: paidUsers } = await client
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .in('subscription_tier', ['pro', 'enterprise'])
      .eq('subscription_status', 'active');

    const currentPaidUsers = paidUsers || 0;
    const now = new Date();
    const targetDate = new Date(goal.target_date);
    const daysRemaining = Math.max(
      0,
      Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    );

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const { count: newPaidLast30d } = await client
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .in('subscription_tier', ['pro', 'enterprise'])
      .eq('subscription_status', 'active')
      .gte('created_at', thirtyDaysAgo.toISOString());

    const currentGrowthRate = (newPaidLast30d || 0) / 30;
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
        targetDate: goal.target_date,
        milestones: goal.milestones,
        isActive: goal.is_active,
      },
      currentPaidUsers,
      daysRemaining,
      currentGrowthRate: Math.round(currentGrowthRate * 100) / 100,
      requiredGrowthRate: Math.round(requiredGrowthRate * 100) / 100,
      milestoneProgress,
    };
  }

  private emptyGrowthProgress(): GrowthProgress {
    return {
      goal: {
        id: '',
        name: 'No active goal',
        targetPaidUsers: 0,
        targetDate: '',
        milestones: [],
        isActive: false,
      },
      currentPaidUsers: 0,
      daysRemaining: 0,
      currentGrowthRate: 0,
      requiredGrowthRate: 0,
      milestoneProgress: [],
    };
  }
}
