/**
 * Mock API Responses for E2E Testing
 *
 * These fixtures provide consistent test data for Playwright E2E tests.
 * Used to mock API responses when testing UI components independently.
 */

// Score response for a typical ZIP code with all data available
export const MOCK_FULL_SCORE_RESPONSE = {
  success: true,
  data: {
    geographyId: '90210',
    geographyType: 'zip',
    geographyName: 'Beverly Hills, CA 90210',
    periodDate: '2024-01-01',

    marketHealth: {
      score: 72,
      trend: 'up' as const,
      trendValue: 3,
      confidence: 85,
      status: 'complete' as const,
      components: {
        demand_strength: { score: 78, weight: 0.35 },
        supply_balance: { score: 65, weight: 0.25 },
        price_stability: { score: 70, weight: 0.25 },
        economic_foundation: { score: 75, weight: 0.15 },
      },
    },

    homeready: {
      score: 68,
      trend: 'stable' as const,
      trendValue: 1,
      confidence: 82,
      status: 'complete' as const,
      components: {
        affordability: { score: 55, weight: 0.30 },
        market_timing: { score: 72, weight: 0.25 },
        stability: { score: 75, weight: 0.20 },
        growth_potential: { score: 68, weight: 0.15 },
        livability: { score: 80, weight: 0.10 },
      },
    },

    investoredge: {
      score: 74,
      trend: 'up' as const,
      trendValue: 5,
      confidence: 88,
      status: 'complete' as const,
      components: {
        cash_flow: { score: 70, weight: 0.35 },
        rent_demand: { score: 82, weight: 0.20 },
        appreciation: { score: 75, weight: 0.20 },
        entry_point: { score: 65, weight: 0.15 },
        risk: { score: 78, weight: 0.10 },
      },
    },

    dataCompleteness: 0.95,
    calculatedAt: '2024-01-15T10:30:00Z',
    formulaVersion: '1.2.0',
  },
};

// Teaser response for gated scores (free tier users)
export const MOCK_TEASER_SCORE_RESPONSE = {
  success: true,
  data: {
    geographyId: '90210',
    geographyType: 'zip',
    geographyName: 'Beverly Hills, CA 90210',
    periodDate: '2024-01-01',

    marketHealth: {
      score: 72,
      trend: 'up' as const,
      trendValue: 3,
      confidence: 85,
      status: 'complete' as const,
      components: {
        demand_strength: { score: 78, weight: 0.35 },
        supply_balance: { score: 65, weight: 0.25 },
        price_stability: { score: 70, weight: 0.25 },
        economic_foundation: { score: 75, weight: 0.15 },
      },
    },

    // Teaser only - no detailed data
    homeready: {
      score: 68,
      trend: 'stable' as const,
      trendValue: 1,
      confidence: 82,
      status: 'teaser' as const,
      components: null, // Gated
      upgradeRequired: true,
      tierRequired: 'pro',
    },

    investoredge: {
      score: 74,
      trend: 'up' as const,
      trendValue: 5,
      confidence: 88,
      status: 'teaser' as const,
      components: null, // Gated
      upgradeRequired: true,
      tierRequired: 'pro',
    },

    dataCompleteness: 0.95,
    calculatedAt: '2024-01-15T10:30:00Z',
  },
};

// Response for geography with sparse/missing data
export const MOCK_PARTIAL_SCORE_RESPONSE = {
  success: true,
  data: {
    geographyId: '99501',
    geographyType: 'zip',
    geographyName: 'Anchorage, AK 99501',
    periodDate: '2024-01-01',

    marketHealth: {
      score: 55,
      trend: 'stable' as const,
      trendValue: 0,
      confidence: 62,
      status: 'partial' as const,
      components: {
        demand_strength: { score: 58, weight: 0.35 },
        supply_balance: { score: 52, weight: 0.25 },
        price_stability: { score: null, weight: 0.25, missing: true },
        economic_foundation: { score: 55, weight: 0.15 },
      },
      missingMetrics: ['price_volatility', 'foreclosure_rate'],
    },

    homeready: {
      score: null,
      trend: null,
      trendValue: null,
      confidence: null,
      status: 'unavailable' as const,
      reason: 'Insufficient data: only 40% of weighted metrics available',
    },

    investoredge: {
      score: 48,
      trend: 'down' as const,
      trendValue: -2,
      confidence: 55,
      status: 'partial' as const,
      components: {
        cash_flow: { score: 45, weight: 0.35 },
        rent_demand: { score: 50, weight: 0.20, inherited: true, source: 'state' },
        appreciation: { score: 52, weight: 0.20 },
        entry_point: { score: 48, weight: 0.15 },
        risk: { score: null, weight: 0.10, missing: true },
      },
    },

    dataCompleteness: 0.65,
    calculatedAt: '2024-01-15T10:30:00Z',
  },
};

// Response for invalid/not found geography
export const MOCK_NOT_FOUND_RESPONSE = {
  success: false,
  error: 'Geography not found',
  code: 'GEOGRAPHY_NOT_FOUND',
};

// Admin dashboard - confidence matrix data
export const MOCK_CONFIDENCE_MATRIX = {
  success: true,
  data: {
    matrix: [
      {
        scoreType: 'market_health',
        geographyType: 'state',
        confidenceScore: 92,
        sampleCount: 51,
        rSquared: 0.78,
        status: 'healthy',
        lastBacktest: '2024-01-14T08:00:00Z',
      },
      {
        scoreType: 'market_health',
        geographyType: 'metro',
        confidenceScore: 88,
        sampleCount: 384,
        rSquared: 0.72,
        status: 'healthy',
        lastBacktest: '2024-01-14T08:00:00Z',
      },
      {
        scoreType: 'market_health',
        geographyType: 'county',
        confidenceScore: 75,
        sampleCount: 500,
        rSquared: 0.65,
        status: 'monitor',
        lastBacktest: '2024-01-14T08:00:00Z',
      },
      {
        scoreType: 'market_health',
        geographyType: 'zip',
        confidenceScore: 68,
        sampleCount: 2000,
        rSquared: 0.55,
        status: 'monitor',
        lastBacktest: '2024-01-14T08:00:00Z',
      },
      {
        scoreType: 'homeready',
        geographyType: 'state',
        confidenceScore: 85,
        sampleCount: 51,
        rSquared: 0.68,
        status: 'healthy',
        lastBacktest: '2024-01-14T08:00:00Z',
      },
      {
        scoreType: 'homeready',
        geographyType: 'metro',
        confidenceScore: 72,
        sampleCount: 384,
        rSquared: 0.58,
        status: 'monitor',
        lastBacktest: '2024-01-14T08:00:00Z',
      },
      {
        scoreType: 'homeready',
        geographyType: 'county',
        confidenceScore: 58,
        sampleCount: 500,
        rSquared: 0.45,
        status: 'review',
        lastBacktest: '2024-01-14T08:00:00Z',
      },
      {
        scoreType: 'homeready',
        geographyType: 'zip',
        confidenceScore: 52,
        sampleCount: 2000,
        rSquared: 0.38,
        status: 'review',
        lastBacktest: '2024-01-14T08:00:00Z',
      },
      {
        scoreType: 'investoredge',
        geographyType: 'state',
        confidenceScore: 78,
        sampleCount: 51,
        rSquared: 0.62,
        status: 'healthy',
        lastBacktest: '2024-01-14T08:00:00Z',
      },
      {
        scoreType: 'investoredge',
        geographyType: 'metro',
        confidenceScore: 65,
        sampleCount: 384,
        rSquared: 0.52,
        status: 'monitor',
        lastBacktest: '2024-01-14T08:00:00Z',
      },
      {
        scoreType: 'investoredge',
        geographyType: 'county',
        confidenceScore: 55,
        sampleCount: 500,
        rSquared: 0.42,
        status: 'review',
        lastBacktest: '2024-01-14T08:00:00Z',
      },
      {
        scoreType: 'investoredge',
        geographyType: 'zip',
        confidenceScore: 48,
        sampleCount: 2000,
        rSquared: 0.35,
        status: 'review',
        lastBacktest: '2024-01-14T08:00:00Z',
      },
    ],
    lastUpdated: '2024-01-14T08:00:00Z',
  },
};

// Admin dashboard - backtest run result
export const MOCK_BACKTEST_RESULT = {
  success: true,
  data: {
    id: 'bt-2024-01-15-001',
    status: 'completed',
    scoreType: 'market_health',
    geographyType: 'metro',
    startedAt: '2024-01-15T10:00:00Z',
    completedAt: '2024-01-15T10:05:32Z',
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
    status: 'healthy',
  },
};

// Admin dashboard - alerts
export const MOCK_ALERTS = {
  success: true,
  data: {
    alerts: [
      {
        id: 'alert-001',
        type: 'degradation',
        severity: 'warning',
        scoreType: 'homeready',
        geographyType: 'county',
        message: 'HomeReady confidence dropped 12 points for County level',
        previousConfidence: 70,
        currentConfidence: 58,
        createdAt: '2024-01-14T15:30:00Z',
        status: 'open',
      },
      {
        id: 'alert-002',
        type: 'threshold',
        severity: 'critical',
        scoreType: 'investoredge',
        geographyType: 'zip',
        message: 'InvestorEdge confidence below critical threshold for ZIP level',
        currentConfidence: 35,
        thresholdCrossed: 40,
        createdAt: '2024-01-13T09:15:00Z',
        status: 'acknowledged',
        acknowledgedBy: 'admin@propertyiq.com',
        acknowledgedAt: '2024-01-13T10:00:00Z',
      },
    ],
    totalOpen: 1,
    totalAcknowledged: 1,
  },
};

// Score colors based on value
export function getScoreColor(score: number | null): string {
  if (score === null) return 'gray';
  if (score >= 70) return 'green';
  if (score >= 55) return 'amber';
  if (score >= 40) return 'orange';
  return 'red';
}

// Confidence stars based on percentage
export function getConfidenceStars(confidence: number | null): number {
  if (confidence === null) return 0;
  if (confidence >= 90) return 5;
  if (confidence >= 70) return 4;
  if (confidence >= 55) return 3;
  if (confidence >= 40) return 2;
  return 1;
}

// Trend direction
export type TrendDirection = 'up' | 'down' | 'stable';

export function getTrendDirection(
  currentScore: number,
  previousScore: number,
  threshold: number = 2
): TrendDirection {
  const diff = currentScore - previousScore;
  if (diff > threshold) return 'up';
  if (diff < -threshold) return 'down';
  return 'stable';
}
