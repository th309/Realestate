const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export interface BenchmarkResult {
  metricId: string;
  value: number | null;
  parentGeo: { level: string; id: string; name: string } | null;
  parentValue: number | null;
  diff: number | null;
  direction: 'better' | 'worse' | 'similar' | null;
}

export async function fetchBenchmarks(
  geoLevel: string,
  geoId: string,
  metricIds: string[],
): Promise<BenchmarkResult[]> {
  if (!metricIds.length) return [];

  const metricsParam = metricIds.join(',');
  const response = await fetch(
    `${API_URL}/api/benchmarks/${geoLevel}/${geoId}?metrics=${metricsParam}`
  );

  if (!response.ok) return [];

  const data = await response.json();
  return Array.isArray(data) ? data : data.data || [];
}
