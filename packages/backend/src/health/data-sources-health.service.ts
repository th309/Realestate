/**
 * Data Sources Health Service
 *
 * Monitors the health of external data sources:
 * - Zillow S3, Census API, BLS API, Realtor S3, HUD API, Building Permits
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

const DATA_SOURCES: SourceConfig[] = [
  { sourceName: 'zillow_s3', displayName: 'Zillow', sourceType: 's3', tableName: 'zillow_zip', dateColumn: 'date', expectedFreshnessDays: 45 },
  { sourceName: 'census_api', displayName: 'Census', sourceType: 'api', tableName: 'census_zip', dateColumn: 'year', expectedFreshnessDays: 400 },
  { sourceName: 'bls_api', displayName: 'BLS', sourceType: 'api', tableName: 'economic_county', dateColumn: 'date', expectedFreshnessDays: 45 },
  { sourceName: 'realtor_s3', displayName: 'Realtor', sourceType: 's3', tableName: 'realtor_zip', dateColumn: 'month_date_yyyymm', expectedFreshnessDays: 7 },
  { sourceName: 'hud_api', displayName: 'HUD FMR', sourceType: 'api', tableName: 'hud_fmr', dateColumn: 'fiscal_year', expectedFreshnessDays: 400 },
  { sourceName: 'permits_census', displayName: 'Building Permits', sourceType: 'api', tableName: 'permits_county', dateColumn: 'date', expectedFreshnessDays: 45 },
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
        // Year format (e.g., 2023)
        date = new Date(dateValue, 0, 1);
      } else if (dateValue.length === 6) {
        // YYYYMM format
        const year = parseInt(dateValue.substring(0, 4), 10);
        const month = parseInt(dateValue.substring(4, 6), 10) - 1;
        date = new Date(year, month, 1);
      } else {
        date = new Date(dateValue);
      }

      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    } catch {
      return null;
    }
  }
}
