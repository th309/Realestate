/**
 * API CLIENT (MINIMAL)
 *
 * This file contains only the API functions that are NOT yet migrated to lib/data.
 * Most data fetching is now handled by @/lib/data - import from there for:
 * - fetchAPI, fetchAPIWithParams
 * - Metric data (fetchSnapshotData, fetchTimeSeriesData)
 * - Score data (fetchScore, fetchBatchScores)
 * - All types (GeoLevel, MetricFormat, etc.)
 *
 * This file will be removed once remaining usages are migrated.
 */

// Re-export commonly used items from lib/data for backward compatibility
export { fetchAPI, type ScoreResponse, type TimeSeriesDataPoint } from '@/lib/data';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// ============================================================================
// TYPES STILL NEEDED
// ============================================================================

export interface MarketStats {
  totalMarkets: number;
  totalStates: number;
  totalCounties: number;
  totalZips: number;
}

// Legacy score response interface (used by useRightPanelData)
interface LegacyScoreResponse {
  homereadyScore?: number;
  investoredgeScore?: number;
  marketHealthScore?: number;
  [key: string]: unknown;
}

// ============================================================================
// API OBJECT - REMAINING FUNCTIONS
// ============================================================================

export const api = {
  /**
   * Get market statistics (counts of markets, states, etc.)
   */
  getStats: async (): Promise<MarketStats> => {
    const response = await fetch(`${API_URL}/api/markets/stats`);
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    return response.json();
  },

  /**
   * Get PropertyIQ score for a specific geography
   * @deprecated Use fetchScore from @/lib/data instead
   */
  getScore: async (geographyType: string, geographyId: string): Promise<LegacyScoreResponse | null> => {
    try {
      const response = await fetch(`${API_URL}/api/scores/${geographyType}/${encodeURIComponent(geographyId)}`);
      if (!response.ok) {
        console.error('Failed to fetch score:', response.status);
        return null;
      }
      const data = await response.json();

      // Transform to legacy format expected by existing consumers
      return {
        homereadyScore: data?.scores?.homeready?.score,
        investoredgeScore: data?.scores?.investoredge?.score,
        marketHealthScore: data?.scores?.markethealth?.score,
        ...data,
      };
    } catch (error) {
      console.error('Failed to fetch score:', error);
      return null;
    }
  },
};
