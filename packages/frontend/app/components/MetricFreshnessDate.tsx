'use client';

import type { GeoLevel } from '@/lib/data';
import { useMetricFreshness } from '@/lib/data/hooks';

interface MetricFreshnessDateProps {
  metricId: string;
  geoLevel?: GeoLevel;
  fallback?: string;
}

export function MetricFreshnessDate({ metricId, geoLevel, fallback = '\u2014' }: MetricFreshnessDateProps) {
  const { formattedDate } = useMetricFreshness(metricId, geoLevel);
  return <>{formattedDate || fallback}</>;
}

export default MetricFreshnessDate;

