/**
 * SCORE HEATMAP FETCHER
 *
 * Fetches the full packed metro score history for the Market Momentum Map
 * widget: month index, metro centroids, and a dense score matrix where
 * scores[metroIdx][monthIdx] is a 1-99 integer (0 = no data that month).
 * Public endpoint — safe for anonymous marketing pages.
 */

import { fetchAPI } from "./base";

export interface ScoreHeatmapMetro {
  /** CBSA code */
  id: string;
  name: string;
  lat: number;
  lon: number;
  pop: number | null;
  /** Latest-month confidence level (A/B/C/F) */
  conf: string | null;
}

export interface ScoreHeatmapPayload {
  /** ISO dates ascending, one per scored month */
  months: string[];
  metros: ScoreHeatmapMetro[];
  /** scores[metroIdx][monthIdx], 1-99, 0 = no data */
  scores: number[][];
}

export function isValidHeatmapPayload(
  payload: ScoreHeatmapPayload | null,
): payload is ScoreHeatmapPayload {
  return (
    !!payload &&
    Array.isArray(payload.months) &&
    payload.months.length > 0 &&
    Array.isArray(payload.metros) &&
    payload.metros.length > 0 &&
    Array.isArray(payload.scores) &&
    payload.scores.length === payload.metros.length &&
    payload.scores.every((row) => row.length === payload.months.length)
  );
}

export async function fetchScoreHeatmap(): Promise<ScoreHeatmapPayload | null> {
  try {
    const payload = await fetchAPI<ScoreHeatmapPayload>(
      "/api/scores/heatmap/metro",
    );
    return isValidHeatmapPayload(payload) ? payload : null;
  } catch (error) {
    console.error("Failed to fetch score heatmap:", error);
    return null;
  }
}
