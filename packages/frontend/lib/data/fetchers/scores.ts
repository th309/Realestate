/**
 * SCORE DATA FETCHER
 *
 * Fetches PropertyIQ score data for specific geographies.
 * Supports single and batch score fetching.
 */

import type { ScoreResponse, BatchScoreResponse } from '../types';
import { fetchAPI } from './base';

/**
 * Fetch PropertyIQ score for a specific geography
 *
 * @param geographyType - The geography type (metro, county, zip)
 * @param geographyId - The geography identifier
 * @returns Promise<ScoreResponse | null>
 */
export async function fetchScore(
  geographyType: string,
  geographyId: string
): Promise<ScoreResponse | null> {
  try {
    const response = await fetchAPI<ScoreResponse>(
      `/api/scores/${geographyType}/${geographyId}`
    );
    return response;
  } catch (error) {
    console.error('Failed to fetch score:', error);
    return null;
  }
}

/**
 * Fetch scores for multiple geographies
 *
 * @param geographyType - The geography type
 * @param ids - Array of geography identifiers
 * @returns Promise<BatchScoreResponse | null>
 */
export async function fetchBatchScores(
  geographyType: string,
  ids: string[]
): Promise<BatchScoreResponse | null> {
  try {
    const response = await fetchAPI<BatchScoreResponse>(
      `/api/scores/batch/${geographyType}?ids=${ids.join(',')}`
    );
    return response;
  } catch (error) {
    console.error('Failed to fetch batch scores:', error);
    return null;
  }
}

/**
 * Fetch score with expanded details and optional history
 *
 * @param geographyType - The geography type
 * @param geographyId - The geography identifier
 * @param options - Optional parameters
 * @returns Promise<ScoreResponse | null>
 */
export async function fetchScoreExpanded(
  geographyType: string,
  geographyId: string,
  options?: {
    expanded?: boolean;
    historyMonths?: number;
  }
): Promise<ScoreResponse | null> {
  try {
    const params = new URLSearchParams();
    if (options?.expanded) params.append('expanded', 'true');
    if (options?.historyMonths && options.historyMonths > 0) {
      params.append('historyMonths', options.historyMonths.toString());
    }

    const queryString = params.toString();
    const endpoint = `/api/scores/${geographyType}/${encodeURIComponent(geographyId)}${queryString ? `?${queryString}` : ''}`;

    return await fetchAPI<ScoreResponse>(endpoint);
  } catch (error) {
    console.error('Failed to fetch expanded score:', error);
    return null;
  }
}
