/**
 * JourneysTab
 *
 * User journey analytics: landing pages, exit pages, navigation flows,
 * common paths, and session duration distribution.
 */

'use client';

import type { AnalyticsFilters } from '@/lib/data/fetchers/admin-analytics.types';
import { EmptyState } from '../shared/EmptyState';
import { SkeletonLoader } from '../shared/SkeletonLoader';

interface JourneysTabProps {
  days: number;
  filters: AnalyticsFilters;
  compare: boolean;
  onDrillDown: (key: string, value: string) => void;
}

export function JourneysTab({ days, filters, compare, onDrillDown }: JourneysTabProps) {
  const loading = false;

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonLoader variant="table" />
        <SkeletonLoader variant="chart" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <EmptyState
        title="Journeys coming soon"
        description={`Landing pages, exit pages, navigation flows, and session paths for the last ${days} days will appear here.`}
      />
    </div>
  );
}
