/**
 * METRIC ACCESS HOOK
 *
 * Shared gating utility for data hooks. Checks entitlement access
 * for a metric and returns gating info. All data hooks call this
 * instead of duplicating the entitlements check.
 */

'use client';

import { useEntitlements } from '@/lib/entitlements';
import type { AccessInfo, UserTier } from '@/lib/entitlements';

export interface MetricAccessResult {
  /** Whether this metric is fully gated (no access) */
  gated: boolean;
  /** Whether this metric is in preview mode */
  preview: boolean;
  /** Preview limit (e.g., months of history, row count) */
  previewLimit: number | null;
  /** Tier required to unlock */
  tierRequired: UserTier | null;
  /** Raw access info */
  accessInfo: AccessInfo;
}

/**
 * Check entitlement access for a metric.
 * Used internally by data hooks to gate API calls.
 *
 * @param metricId - The metric identifier from registry
 * @returns Gating info including whether the metric is blocked or in preview
 */
export function useMetricAccess(metricId: string): MetricAccessResult {
  const { getAccess } = useEntitlements();
  const accessInfo = getAccess('metric', metricId);

  return {
    gated: accessInfo.level === 'none',
    preview: accessInfo.level === 'preview',
    previewLimit: accessInfo.level === 'preview' ? (accessInfo.limit ?? null) : null,
    tierRequired: accessInfo.tierRequired ?? null,
    accessInfo,
  };
}
