import { IsOptional, IsString, Matches } from 'class-validator';

/**
 * Query DTO for GET /api/analyzer/market-context.
 * Exactly one of zip / county_fips / state should be supplied.
 */
export class MarketContextQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{5}$/, { message: 'zip must be a 5-digit string' })
  zip?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{5}$/, { message: 'county_fips must be a 5-digit string' })
  county_fips?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/, { message: 'state must be a 2-letter uppercase code' })
  state?: string;
}

/** Resolved (value, source) tuple emitted to the analyzer client. */
export interface MetricValueDto {
  value: number | null;
  source: string | null;
}

export type AnalyzerGeoLevel = 'zip' | 'county' | 'metro' | 'state';

export interface MarketContextDto {
  geo_level: AnalyzerGeoLevel | null;
  geo_id: string | null;
  home_value: MetricValueDto | null;
  rent_index: MetricValueDto | null;
  market_heat: MetricValueDto | null;
  net_migration: MetricValueDto | null;
  piq_score: { value: number; label: string } | null;
}
