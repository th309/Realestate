/**
 * Scoring Distribution
 *
 * Score distribution analysis: histograms, grade breakdowns, and statistics.
 * Used for analytics dashboards and score context displays.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ScoreType, GeographyLevel } from './formula-weights';
import { getLatestScoreDate } from './scoring-queries';

export interface ScoreDistributionResult {
  geography: GeographyLevel;
  score_type: ScoreType;
  score_date: string;
  total_count: number;
  distribution: Array<{
    bucket: string;
    min: number;
    max: number;
    count: number;
    percentage: number;
  }>;
  statistics: {
    mean: number;
    median: number;
    std_dev: number;
    min: number;
    max: number;
  };
  grade_distribution: Array<{
    grade: string;
    count: number;
    percentage: number;
  }>;
}

/**
 * Get score distribution for a geography and score type.
 * Returns histogram buckets (0-10, 10-20, ..., 90-100) with counts.
 */
export async function getScoreDistribution(
  supabase: SupabaseClient,
  geography: GeographyLevel,
  scoreType: ScoreType,
  periodDate?: string,
): Promise<ScoreDistributionResult> {
  const targetDate = periodDate || (await getLatestScoreDate(supabase, geography));
  if (!targetDate) {
    return {
      geography,
      score_type: scoreType,
      score_date: '',
      total_count: 0,
      distribution: [],
      statistics: { mean: 0, median: 0, std_dev: 0, min: 0, max: 0 },
      grade_distribution: [],
    };
  }

  // Fetch all scores for this geography and score type
  const allScores: number[] = [];
  const allGrades: string[] = [];
  const pageSize = 1000;
  let page = 0;

  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const { data, error } = await supabase
      .from('propertyiq_scores')
      .select('score, grade')
      .eq('geography', geography)
      .eq('score_type', scoreType)
      .eq('score_date', targetDate)
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch scores for distribution: ${error.message}`);
    }
    if (!data || data.length === 0) break;

    for (const row of data) {
      if (row.score !== null && row.score !== undefined) {
        allScores.push(row.score);
        allGrades.push(row.grade || 'F');
      }
    }

    if (data.length < pageSize) break;
    page += 1;
  }

  if (allScores.length === 0) {
    return {
      geography,
      score_type: scoreType,
      score_date: targetDate,
      total_count: 0,
      distribution: [],
      statistics: { mean: 0, median: 0, std_dev: 0, min: 0, max: 0 },
      grade_distribution: [],
    };
  }

  // Calculate histogram buckets (0-10, 10-20, ..., 90-100)
  const buckets = [
    { bucket: '0-10', min: 0, max: 10, count: 0 },
    { bucket: '10-20', min: 10, max: 20, count: 0 },
    { bucket: '20-30', min: 20, max: 30, count: 0 },
    { bucket: '30-40', min: 30, max: 40, count: 0 },
    { bucket: '40-50', min: 40, max: 50, count: 0 },
    { bucket: '50-60', min: 50, max: 60, count: 0 },
    { bucket: '60-70', min: 60, max: 70, count: 0 },
    { bucket: '70-80', min: 70, max: 80, count: 0 },
    { bucket: '80-90', min: 80, max: 90, count: 0 },
    { bucket: '90-100', min: 90, max: 100, count: 0 },
  ];

  for (const score of allScores) {
    const bucketIndex = Math.min(Math.floor(score / 10), 9);
    buckets[bucketIndex].count += 1;
  }

  const totalCount = allScores.length;
  const distribution = buckets.map(b => ({
    ...b,
    percentage: Math.round((b.count / totalCount) * 1000) / 10,
  }));

  // Calculate statistics
  const sortedScores = [...allScores].sort((a, b) => a - b);
  const mean = allScores.reduce((a, b) => a + b, 0) / totalCount;
  const median = totalCount % 2 === 0
    ? (sortedScores[totalCount / 2 - 1] + sortedScores[totalCount / 2]) / 2
    : sortedScores[Math.floor(totalCount / 2)];
  const variance = allScores.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / totalCount;
  const stdDev = Math.sqrt(variance);

  const statistics = {
    mean: Math.round(mean * 100) / 100,
    median: Math.round(median * 100) / 100,
    std_dev: Math.round(stdDev * 100) / 100,
    min: Math.round(Math.min(...allScores) * 100) / 100,
    max: Math.round(Math.max(...allScores) * 100) / 100,
  };

  // Calculate grade distribution
  const gradeCounts: Record<string, number> = {};
  for (const grade of allGrades) {
    gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
  }

  const gradeOrder = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];
  const grade_distribution = gradeOrder
    .filter(g => gradeCounts[g] !== undefined)
    .map(grade => ({
      grade,
      count: gradeCounts[grade],
      percentage: Math.round((gradeCounts[grade] / totalCount) * 1000) / 10,
    }));

  return {
    geography,
    score_type: scoreType,
    score_date: targetDate,
    total_count: totalCount,
    distribution,
    statistics,
    grade_distribution,
  };
}

/**
 * Get score distribution for all score types at once.
 */
export async function getAllScoreDistributions(
  supabase: SupabaseClient,
  geography: GeographyLevel,
  periodDate?: string,
): Promise<{
  geography: GeographyLevel;
  score_date: string;
  distributions: {
    homeready: ScoreDistributionResult;
    investoredge: ScoreDistributionResult;
    markethealth: ScoreDistributionResult;
  };
}> {
  const targetDate = periodDate || (await getLatestScoreDate(supabase, geography));

  const [homeready, investoredge, markethealth] = await Promise.all([
    getScoreDistribution(supabase, geography, 'homeready', targetDate || undefined),
    getScoreDistribution(supabase, geography, 'investoredge', targetDate || undefined),
    getScoreDistribution(supabase, geography, 'markethealth', targetDate || undefined),
  ]);

  return {
    geography,
    score_date: targetDate || '',
    distributions: {
      homeready,
      investoredge,
      markethealth,
    },
  };
}
