'use client';

import { useState, useEffect } from 'react';
import { fetchBenchmarks, type BenchmarkResult } from './api';
import { useEntitlements } from '@/lib/entitlements';

export function useBenchmarks(
  geoLevel: string,
  geoId: string,
  metricIds: string[],
) {
  const { getAccess } = useEntitlements();
  const [benchmarks, setBenchmarks] = useState<BenchmarkResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Check if user has benchmarking access
  const access = getAccess('feature', 'benchmarking');
  const hasAccess = access.level === 'full';

  useEffect(() => {
    if (!hasAccess || !geoLevel || !geoId || !metricIds.length) {
      setBenchmarks([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    fetchBenchmarks(geoLevel, geoId, metricIds)
      .then((data) => {
        if (!cancelled) setBenchmarks(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [hasAccess, geoLevel, geoId, metricIds.join(',')]);

  return { benchmarks, isLoading, error, hasAccess };
}

/** Get benchmark for a specific metric from the benchmarks array */
export function getBenchmarkForMetric(
  benchmarks: BenchmarkResult[],
  metricId: string,
): BenchmarkResult | null {
  return benchmarks.find(b => b.metricId === metricId) ?? null;
}
