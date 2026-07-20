import { CHURN_REASON_LABELS } from '@propertyiq/emails';
import type { UserTrial } from './trial.service';

interface TrialProfile {
  id: string;
  email: string | null;
  full_name: string | null;
}

interface ChurnResponseRow {
  user_id: string;
  reason_code: string;
  detail: string | null;
  created_at: string;
}

/** Left-joins profile identity, paywall-hit count, and the latest churn
 * response onto each trial row. Pure — callers fetch the inputs. */
export function hydrateTrialRecords(
  trials: UserTrial[],
  profiles: TrialProfile[],
  paywallCounts: Map<string, number>,
  churnResponses: ChurnResponseRow[],
  now: number,
): UserTrial[] {
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  // churnResponses may contain multiple rows per user (one per email_type);
  // keep only the most recent per user_id.
  const latestChurnByUser = new Map<string, ChurnResponseRow>();
  for (const row of churnResponses) {
    const existing = latestChurnByUser.get(row.user_id);
    if (!existing || row.created_at > existing.created_at) {
      latestChurnByUser.set(row.user_id, row);
    }
  }

  return trials.map((trial) => {
    const profile = profileById.get(trial.user_id);
    const churn = latestChurnByUser.get(trial.user_id);
    const daysRemaining = Math.ceil(
      (new Date(trial.expires_at).getTime() - now) / (24 * 60 * 60 * 1000),
    );

    return {
      ...trial,
      user_email: profile?.email ?? undefined,
      user_name: profile?.full_name ?? undefined,
      days_remaining: daysRemaining,
      paywall_hits: paywallCounts.get(trial.user_id) ?? 0,
      reason_code: churn?.reason_code ?? null,
      reason_label: churn
        ? (CHURN_REASON_LABELS[churn.reason_code] ?? churn.reason_code)
        : null,
      detail: churn?.detail ?? null,
    };
  });
}

interface TrialStatusCounts {
  active: number;
  expired: number;
  converted: number;
  cancelled: number;
  expiringSoon: number;
}

export interface TrialStatsResult {
  active_count: number;
  expired_count: number;
  converted_count: number;
  cancelled_count: number;
  expiring_soon_count: number;
  conversion_rate: number;
  avg_sessions: number;
}

/** Derives conversion rate and average session count from raw counts. Pure —
 * callers fetch the counts and the per-active-user session-count list. */
export function computeTrialStats(
  counts: TrialStatusCounts,
  activeUserSessionCounts: number[],
): TrialStatsResult {
  const totalCompleted = counts.expired + counts.converted + counts.cancelled;
  const conversionRate =
    totalCompleted > 0 ? (counts.converted / totalCompleted) * 100 : 0;

  const avgSessions =
    activeUserSessionCounts.length > 0
      ? activeUserSessionCounts.reduce((sum, n) => sum + n, 0) /
        activeUserSessionCounts.length
      : 0;

  return {
    active_count: counts.active,
    expired_count: counts.expired,
    converted_count: counts.converted,
    cancelled_count: counts.cancelled,
    expiring_soon_count: counts.expiringSoon,
    conversion_rate: Math.round(conversionRate * 10) / 10,
    avg_sessions: Math.round(avgSessions * 10) / 10,
  };
}
