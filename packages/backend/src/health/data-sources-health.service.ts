/**
 * Data Sources Health Service
 *
 * Monitors the health of external data sources:
 * - Zillow S3: Home values, market indicators (monthly)
 * - Realtor S3: Listing data, inventory (monthly)
 * - Census ACS: Demographics, income (annual, 5-year estimates)
 * - BLS API: Unemployment, employment (monthly)
 * - FRED API: National economic indicators, mortgage rates (monthly)
 * - HUD API: Fair Market Rents (annual)
 * - Building Permits: Construction activity (monthly)
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface SourceHealth {
  sourceName: string;
  displayName: string;
  sourceType: 's3' | 'api';
  available: boolean;
  responseTimeMs: number | null;
  fresh: boolean;
  daysSinceUpdate: number | null;
  expectedFreshnessDays: number;
  schemaChanged: boolean;
  lastCheck: string;
  errorMessage?: string;
}

export interface DataSourcesHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  sources: SourceHealth[];
  summary: {
    total: number;
    available: number;
    fresh: number;
  };
}

interface SourceConfig {
  sourceName: string;
  displayName: string;
  sourceType: 's3' | 'api';
  tableName: string;
  dateColumn: string;
  expectedFreshnessDays: number;
}

/**
 * Data Source Configurations
 *
 * Each source may have multiple tables at different geographic levels.
 * We check the most commonly used table for each source.
 *
 * Freshness is based on the "as of" date of the data (period_date/year),
 * showing how current the actual data is.
 *
 * Date columns:
 * - Zillow: period_date (YYYY-MM-DD)
 * - Realtor: period_date (YYYY-MM-DD)
 * - Census: year (integer, e.g., 2023)
 * - Economic: period_date (YYYY-MM-DD)
 * - Permits: period_date (YYYY-MM-DD)
 * - HUD FMR: year (integer, e.g., 2024)
 *
 * Freshness thresholds: frequency × 1.2
 * - Monthly (30 days): 36 days
 * - Annual (365 days): 438 days
 */
const DATA_SOURCES: SourceConfig[] = [
  // Zillow - Monthly data, check ZIP level (most granular)
  { sourceName: 'zillow_s3', displayName: 'Zillow', sourceType: 's3', tableName: 'zillow_zip', dateColumn: 'period_date', expectedFreshnessDays: 36 },
  // Realtor - Monthly data, check ZIP level (most granular)
  { sourceName: 'realtor_s3', displayName: 'Realtor', sourceType: 's3', tableName: 'realtor_zip', dateColumn: 'period_date', expectedFreshnessDays: 36 },
  // Census/ACS - Annual data (5-year ACS estimates), check county level
  { sourceName: 'census_acs', displayName: 'Census ACS', sourceType: 'api', tableName: 'census_county', dateColumn: 'year', expectedFreshnessDays: 438 },
  // BLS - Monthly unemployment/employment data, check county level
  { sourceName: 'bls_api', displayName: 'BLS', sourceType: 'api', tableName: 'economic_county', dateColumn: 'period_date', expectedFreshnessDays: 36 },
  // FRED - Monthly national economic indicators (mortgage rates, GDP, etc.)
  { sourceName: 'fred_api', displayName: 'FRED', sourceType: 'api', tableName: 'economic_national', dateColumn: 'period_date', expectedFreshnessDays: 36 },
  // HUD FMR - Annual Fair Market Rents
  { sourceName: 'hud_api', displayName: 'HUD FMR', sourceType: 'api', tableName: 'hud_fmr', dateColumn: 'year', expectedFreshnessDays: 438 },
  // Building Permits - Monthly data from Census
  { sourceName: 'permits_census', displayName: 'Building Permits', sourceType: 'api', tableName: 'permits_county', dateColumn: 'period_date', expectedFreshnessDays: 36 },
];

@Injectable()
export class DataSourcesHealthService {
  private readonly logger = new Logger(DataSourcesHealthService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async checkAllSources(): Promise<DataSourcesHealthResponse> {
    const sources: SourceHealth[] = [];

    for (const config of DATA_SOURCES) {
      const health = await this.checkSourceHealth(config);
      sources.push(health);
    }

    const summary = {
      total: sources.length,
      available: sources.filter((s) => s.available).length,
      fresh: sources.filter((s) => s.fresh).length,
    };

    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (summary.available < summary.total - 1) {
      status = 'unhealthy';
    } else if (summary.fresh < summary.total - 1) {
      status = 'degraded';
    }

    return { status, sources, summary };
  }

  private async checkSourceHealth(config: SourceConfig): Promise<SourceHealth> {
    const startTime = Date.now();
    const client = this.supabase.getClient();

    try {
      // Query the table to check availability and freshness
      const { data, error } = await client
        .from(config.tableName)
        .select(config.dateColumn)
        .order(config.dateColumn, { ascending: false })
        .limit(1);

      const responseTimeMs = Date.now() - startTime;

      if (error) {
        return {
          sourceName: config.sourceName,
          displayName: config.displayName,
          sourceType: config.sourceType,
          available: false,
          responseTimeMs,
          fresh: false,
          daysSinceUpdate: null,
          expectedFreshnessDays: config.expectedFreshnessDays,
          schemaChanged: false,
          lastCheck: new Date().toISOString(),
          errorMessage: error.message,
        };
      }

      const latestDate = data?.[0]?.[config.dateColumn];
      const daysSinceUpdate = this.calculateDaysSince(latestDate);
      const fresh = daysSinceUpdate !== null && daysSinceUpdate <= config.expectedFreshnessDays;

      return {
        sourceName: config.sourceName,
        displayName: config.displayName,
        sourceType: config.sourceType,
        available: true,
        responseTimeMs,
        fresh,
        daysSinceUpdate,
        expectedFreshnessDays: config.expectedFreshnessDays,
        schemaChanged: false, // TODO: Implement schema change detection
        lastCheck: new Date().toISOString(),
      };
    } catch (error) {
      return {
        sourceName: config.sourceName,
        displayName: config.displayName,
        sourceType: config.sourceType,
        available: false,
        responseTimeMs: Date.now() - startTime,
        fresh: false,
        daysSinceUpdate: null,
        expectedFreshnessDays: config.expectedFreshnessDays,
        schemaChanged: false,
        lastCheck: new Date().toISOString(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private calculateDaysSince(dateValue: string | number | null): number | null {
    if (!dateValue) return null;

    try {
      let date: Date;
      if (typeof dateValue === 'number') {
        // Year format (e.g., 2023) - use December 31st of that year
        // Annual data for year X is typically released in late X+1
        date = new Date(dateValue, 11, 31); // December 31st
      } else {
        // Standard date format (YYYY-MM-DD)
        date = new Date(dateValue);
      }

      if (isNaN(date.getTime())) return null;

      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    } catch {
      return null;
    }
  }
}
