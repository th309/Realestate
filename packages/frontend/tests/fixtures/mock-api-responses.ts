/**
 * Mock API Responses for E2E Testing
 *
 * These fixtures provide consistent test data for Playwright E2E tests.
 * Used to mock API responses when testing UI components independently.
 */

import { getStarCount } from "@/app/components/scoring/confidence-stars";

// Score response for a typical ZIP code with all data available
export const MOCK_FULL_SCORE_RESPONSE = {
  success: true,
  data: {
    geographyId: "90210",
    geographyType: "zip",
    geographyName: "Beverly Hills, CA 90210",
    periodDate: "2024-01-01",

    propertyiq: {
      score: 72,
      trend: "up" as const,
      trendValue: 3,
      confidence: 85,
      status: "complete" as const,
      components: {
        sold_above_list: { score: 78, weight: 0.33 },
        median_dom: { score: 65, weight: 0.33 },
        months_of_supply: { score: 70, weight: 0.34 },
      },
    },

    dataCompleteness: 0.95,
    calculatedAt: "2024-01-15T10:30:00Z",
    formulaVersion: "2.0.0",
  },
};

// Teaser response for gated scores (free tier users)
export const MOCK_TEASER_SCORE_RESPONSE = {
  success: true,
  data: {
    geographyId: "90210",
    geographyType: "zip",
    geographyName: "Beverly Hills, CA 90210",
    periodDate: "2024-01-01",

    propertyiq: {
      score: 72,
      trend: "up" as const,
      trendValue: 3,
      confidence: 85,
      status: "teaser" as const,
      components: null, // Gated
      upgradeRequired: true,
      tierRequired: "pro",
    },

    dataCompleteness: 0.95,
    calculatedAt: "2024-01-15T10:30:00Z",
  },
};

// Response for geography with sparse/missing data
export const MOCK_PARTIAL_SCORE_RESPONSE = {
  success: true,
  data: {
    geographyId: "99501",
    geographyType: "zip",
    geographyName: "Anchorage, AK 99501",
    periodDate: "2024-01-01",

    propertyiq: {
      score: 55,
      trend: "stable" as const,
      trendValue: 0,
      confidence: 62,
      status: "partial" as const,
      components: {
        sold_above_list: { score: 58, weight: 0.33 },
        median_dom: { score: 52, weight: 0.33 },
        months_of_supply: { score: null, weight: 0.34, missing: true },
      },
      missingMetrics: ["months_of_supply"],
    },

    dataCompleteness: 0.65,
    calculatedAt: "2024-01-15T10:30:00Z",
  },
};

// Response for invalid/not found geography
export const MOCK_NOT_FOUND_RESPONSE = {
  success: false,
  error: "Geography not found",
  code: "GEOGRAPHY_NOT_FOUND",
};

// Admin dashboard - confidence matrix data
export const MOCK_CONFIDENCE_MATRIX = {
  success: true,
  data: {
    matrix: [
      {
        scoreType: "propertyiq",
        geographyType: "state",
        confidenceScore: 92,
        sampleCount: 51,
        rSquared: 0.78,
        status: "healthy",
        lastBacktest: "2024-01-14T08:00:00Z",
      },
      {
        scoreType: "propertyiq",
        geographyType: "metro",
        confidenceScore: 88,
        sampleCount: 384,
        rSquared: 0.72,
        status: "healthy",
        lastBacktest: "2024-01-14T08:00:00Z",
      },
      {
        scoreType: "propertyiq",
        geographyType: "county",
        confidenceScore: 75,
        sampleCount: 500,
        rSquared: 0.65,
        status: "monitor",
        lastBacktest: "2024-01-14T08:00:00Z",
      },
      {
        scoreType: "propertyiq",
        geographyType: "zip",
        confidenceScore: 68,
        sampleCount: 2000,
        rSquared: 0.55,
        status: "monitor",
        lastBacktest: "2024-01-14T08:00:00Z",
      },
    ],
    lastUpdated: "2024-01-14T08:00:00Z",
  },
};

// Admin dashboard - backtest run result
export const MOCK_BACKTEST_RESULT = {
  success: true,
  data: {
    id: "bt-2024-01-15-001",
    status: "completed",
    scoreType: "propertyiq",
    geographyType: "metro",
    startedAt: "2024-01-15T10:00:00Z",
    completedAt: "2024-01-15T10:05:32Z",
    duration: 332000,
    sampleSize: 384,
    metrics: {
      rSquared: 0.72,
      mae: 8.5,
      rmse: 11.2,
      mape: 12.3,
    },
    confidenceScore: 88,
    previousConfidence: 85,
  },
};

// Admin dashboard - alerts
export const MOCK_ALERTS = {
  success: true,
  data: {
    alerts: [
      {
        id: "alert-001",
        type: "degradation",
        severity: "warning",
        scoreType: "propertyiq",
        geographyType: "county",
        message: "PropertyIQ confidence dropped 12 points for County level",
        previousConfidence: 70,
        currentConfidence: 58,
        createdAt: "2024-01-14T15:30:00Z",
        status: "open",
      },
      {
        id: "alert-002",
        type: "threshold",
        severity: "critical",
        scoreType: "propertyiq",
        geographyType: "zip",
        message: "PropertyIQ confidence below critical threshold for ZIP level",
        currentConfidence: 35,
        thresholdCrossed: 40,
        createdAt: "2024-01-13T09:15:00Z",
        status: "acknowledged",
        acknowledgedBy: "admin@propertyiq.com",
        acknowledgedAt: "2024-01-13T10:00:00Z",
      },
    ],
    totalOpen: 1,
    totalAcknowledged: 1,
  },
};

// Score colors based on value
export function getScoreColor(score: number | null): string {
  if (score === null) return "gray";
  if (score >= 70) return "green";
  if (score >= 55) return "amber";
  if (score >= 40) return "orange";
  return "red";
}

// Confidence stars based on percentage. Delegates to the same pure
// getStarCount() ConfidenceDisplay.tsx renders with, so this fixture can
// never drift from the shipped thresholds again.
export function getConfidenceStars(confidence: number | null): number {
  if (confidence === null) return 0;
  return getStarCount(confidence);
}

// Trend direction
export type TrendDirection = "up" | "down" | "stable";

export function getTrendDirection(
  currentScore: number,
  previousScore: number,
  threshold: number = 2,
): TrendDirection {
  const diff = currentScore - previousScore;
  if (diff > threshold) return "up";
  if (diff < -threshold) return "down";
  return "stable";
}
