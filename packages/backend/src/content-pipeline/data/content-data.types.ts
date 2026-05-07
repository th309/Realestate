import { GeoRef } from '../types';

export interface ResolvedMarket {
  geography: GeoRef['geography'];
  id: string;
  canonical_name: string;
  state?: string;
  population?: number;
  /**
   * WGS84 point from `geographies` — same coordinates the product map uses
   * to frame metros/counties/zips. Threaded into video props for Remotion.
   */
  latitude?: number;
  longitude?: number;
  /** Editorial skyline URL for long-form metro hero (optional). */
  hero_image_url?: string;
}

export interface MarketSnapshot {
  geo: GeoRef;
  home_value: { value: number; yoy_pct: number; period_date: string } | null;
  rent: { value: number; yoy_pct: number; period_date: string } | null;
  demographics: {
    population: number;
    median_income: number;
    homeownership_pct: number;
  } | null;
  economic: { unemployment_rate: number; job_growth_yoy_pct: number } | null;
  score: {
    propertyiq_score: number;
    grade: string;
    confidence: string;
    /** Present when scoring API returned history (feeds Remotion TrendChart). */
    history?: Array<{ date: string; score: number }>;
    trend?: 'up' | 'down' | 'stable';
    trend_change?: number;
    /** Score-mover window: anchor rows in `propertyiq_scores` (fact-check month spans). */
    previous_score?: number;
    previous_score_date?: string;
    current_score_date?: string;
    score_delta?: number;
  } | null;
}

export interface PropertyIQScoreResult {
  geo: GeoRef;
  score: number;
  grade: string;
  label: string;
  confidence_pct: number;
  confidence_level: 'A' | 'B' | 'C' | 'F';
  history: Array<{ date: string; score: number }>;
}

export interface TrendingMarketItem {
  geo: GeoRef;
  current_score: number;
  previous_score: number;
  delta: number;
}

export interface CashflowMarketItem {
  geo: GeoRef;
  home_value: number;
  rent: number;
  rent_to_price_ratio: number;
  rank: number;
}
