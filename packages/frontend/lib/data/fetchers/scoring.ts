/**
 * SCORING VALIDATION FETCHERS
 *
 * API functions for score validation and quintile performance data.
 */

import { API_URL } from './base';

export interface QuintilePerformanceData {
  [key: string]: unknown;
}

/**
 * Fetch quintile performance data for a given score type.
 */
export async function fetchQuintilePerformance<T = QuintilePerformanceData>(
  scoreType: string,
): Promise<T> {
  const res = await fetch(
    `${API_URL}/api/scoring/validation/quintile-performance?score_type=${scoreType}`,
  );
  if (!res.ok) {
    throw new Error('Failed to fetch quintile data');
  }
  return res.json();
}

/**
 * Fetch report templates list.
 */
export async function fetchReportTemplates<T = unknown>(): Promise<T[]> {
  const res = await fetch(`${API_URL}/api/reports/templates`);
  if (!res.ok) {
    throw new Error('Failed to fetch templates');
  }
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}
