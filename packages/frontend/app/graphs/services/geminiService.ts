import { getMetricTitle } from '@/lib/data';

interface DataPoint {
  year: number;
  value: number;
}

export async function getInsights(
  area: string,
  metricId: string,
  data: DataPoint[],
  comparisonArea?: string
): Promise<string> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // Get display name for metric
  const metricName = getMetricTitle(metricId);

  // Calculate basic trends
  const latest = data[data.length - 1];
  const previous = data[data.length - 2];
  const oldest = data[0];

  const recentChange =
    latest && previous
      ? ((latest.value - previous.value) / previous.value * 100).toFixed(1)
      : '0';

  const totalChange =
    latest && oldest
      ? ((latest.value - oldest.value) / oldest.value * 100).toFixed(1)
      : '0';

  const trend = parseFloat(recentChange) > 0 ? 'upward' : 'downward';
  const comparison = comparisonArea
    ? ` When compared to ${comparisonArea}, the market shows distinct regional characteristics.`
    : '';

  return `${area}'s ${metricName} market shows a ${trend} trajectory with a ${recentChange}% change year-over-year. Over the analyzed period, the total change was ${totalChange}%.${comparison} Current market conditions suggest continued momentum in this direction based on historical patterns and regional economic indicators.`;
}
