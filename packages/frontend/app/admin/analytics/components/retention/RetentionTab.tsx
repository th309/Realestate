/**
 * RetentionTab
 *
 * Cohort retention matrix, DAU/WAU/MAU stickiness,
 * retention curves by tier, churn signals, and engagement trend.
 */

'use client';

import type { AnalyticsFilters } from '@/lib/data/fetchers/admin-analytics.types';
import { EmptyState } from '../shared/EmptyState';
import { SkeletonLoader } from '../shared/SkeletonLoader';

interface RetentionTabProps {
  days: number;
  filters: AnalyticsFilters;
  compare: boolean;
  onDrillDown: (key: string, value: string) => void;
}

export function RetentionTab({ days, filters, compare, onDrillDown }: RetentionTabProps) {
  const loading = false;

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonLoader variant="card" count={4} />
        <SkeletonLoader variant="chart" />
        <SkeletonLoader variant="table" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <EmptyState
        title="Retention coming soon"
        description={`Cohort matrix, DAU/WAU/MAU, retention curves, and churn signals for the last ${days} days will appear here.`}
      />
    </div>
  );
}
