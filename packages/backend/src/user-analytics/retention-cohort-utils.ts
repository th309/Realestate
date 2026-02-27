/**
 * Pure (stateless) helpers for cohort retention calculations.
 * No I/O — all functions take plain data and return plain data.
 * Consumed by RetentionAnalyticsService.
 */

import type { CohortRow } from './user-analytics.types';

// ---------------------------------------------------------------------------
// Grouping helpers
// ---------------------------------------------------------------------------

export function groupByCohortWeek(
  identities: { user_id: string; signup_cohort: string }[],
): Map<string, Set<string>> {
  const cohortMap = new Map<string, Set<string>>();
  for (const identity of identities) {
    const weekKey = toWeekKey(identity.signup_cohort);
    if (!cohortMap.has(weekKey)) cohortMap.set(weekKey, new Set());
    cohortMap.get(weekKey)!.add(identity.user_id);
  }
  return cohortMap;
}

export function groupSessionsByUser(
  sessions: { user_id: string; started_at: string }[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const session of sessions) {
    if (!session.user_id) continue;
    if (!map.has(session.user_id)) map.set(session.user_id, []);
    map.get(session.user_id)!.push(session.started_at);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Cohort retention matrix
// ---------------------------------------------------------------------------

export function computeCohortRetentionRows(
  cohortMap: Map<string, Set<string>>,
  sessionsByUser: Map<string, string[]>,
): CohortRow[] {
  return Array.from(cohortMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cohortWeek, userIds]) => {
      const cohortSize = userIds.size;
      const cohortStartMs = new Date(cohortWeek).getTime();
      const weekCounts: number[] = [];

      for (let w = 0; w < 12; w++) {
        const weekStart = cohortStartMs + w * 7 * 24 * 60 * 60 * 1000;
        const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000;
        let active = 0;
        for (const uid of userIds) {
          const userSessions = sessionsByUser.get(uid) ?? [];
          const hadSession = userSessions.some((ts) => {
            const t = new Date(ts).getTime();
            return t >= weekStart && t < weekEnd;
          });
          if (hadSession) active++;
        }
        if (active === 0 && w > 0) break;
        weekCounts.push(
          w === 0 ? 100 : parseFloat(((active / cohortSize) * 100).toFixed(1)),
        );
      }

      return { cohort: cohortWeek, cohortSize, weeks: weekCounts };
    });
}

// ---------------------------------------------------------------------------
// Tier-curve aggregation
// ---------------------------------------------------------------------------

export function averageWeeklyCurveAcrossCohorts(rows: CohortRow[]): number[] {
  const maxWeeks = rows.reduce((m, r) => Math.max(m, r.weeks.length), 0);
  const curve: number[] = [];
  for (let w = 0; w < maxWeeks; w++) {
    const rates = rows.map((r) => r.weeks[w] ?? 0).filter((v) => v > 0);
    curve.push(
      rates.length > 0
        ? parseFloat(
            (rates.reduce((a, b) => a + b, 0) / rates.length).toFixed(1),
          )
        : 0,
    );
  }
  return curve;
}

// ---------------------------------------------------------------------------
// Filter helpers
// ---------------------------------------------------------------------------

export function applyTierFilterToIdentities(
  identities: { user_id: string; signup_cohort: string }[],
  sessions: { user_id: string; user_tier: string }[],
  tier?: string,
): { user_id: string; signup_cohort: string }[] {
  if (!tier) return identities;
  const tierUserIds = new Set(
    sessions.filter((s) => s.user_tier === tier).map((s) => s.user_id),
  );
  return identities.filter((i) => tierUserIds.has(i.user_id));
}

export function countUniqueVisitors(
  sessions: { visitor_id: string; started_at: string }[],
  since: string,
): number {
  return new Set(
    sessions.filter((s) => s.started_at >= since).map((s) => s.visitor_id),
  ).size;
}

// ---------------------------------------------------------------------------
// Churn aggregation
// ---------------------------------------------------------------------------

export interface UserSessionStats {
  lastActivityAt: string;
  sessionCount: number;
  tier: string;
}

export function aggregateUserSessionStats(
  sessions: { user_id: string; user_tier: string; last_activity_at: string }[],
): Record<string, UserSessionStats> {
  const stats: Record<string, UserSessionStats> = {};
  for (const s of sessions) {
    if (!s.user_id) continue;
    if (!stats[s.user_id]) {
      stats[s.user_id] = {
        lastActivityAt: s.last_activity_at,
        sessionCount: 0,
        tier: s.user_tier,
      };
    }
    stats[s.user_id].sessionCount++;
    if (s.last_activity_at > stats[s.user_id].lastActivityAt) {
      stats[s.user_id].lastActivityAt = s.last_activity_at;
    }
  }
  return stats;
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

export function toWeekKey(isoDate: string): string {
  const d = new Date(isoDate);
  const dayOfWeek = d.getUTCDay();
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - ((dayOfWeek + 6) % 7));
  return monday.toISOString().slice(0, 10);
}
