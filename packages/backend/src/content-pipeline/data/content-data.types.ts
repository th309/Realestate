import { GeoRef } from '../types';

export interface ResolvedMarket {
  geography: GeoRef['geography'];
  id: string;
  canonical_name: string;
  state?: string;
  population?: number;
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
