import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

type GeoFreshnessKey = 'national' | 'state' | 'metro' | 'county' | 'city' | 'zip';
type EconomicMetricKey = 'unemployment_rate' | 'employment_yoy' | 'gdp_yoy' | 'rpp_all_items';

interface TableProbeConfig {
  tableName: string;
  dateColumn: string;
  filters?: Array<{ column: string; op: 'eq' | 'neq' | 'notNull'; value?: string }>;
}

export interface DataFreshnessResponse {
  generatedAt: string;
  tableDates: Record<string, string | null>;
  sourceDates: Record<string, string | null>;
  zillowDates: {
    historicalByGeo: Record<Exclude<GeoFreshnessKey, 'national'>, string | null>;
    forecastByGeo: Partial<Record<Exclude<GeoFreshnessKey, 'national'>, string | null>>;
  };
  economicMetricDates: Record<EconomicMetricKey, Partial<Record<GeoFreshnessKey, string | null>>>;
}

@Injectable()
export class DataFreshnessService {
  private readonly logger = new Logger(DataFreshnessService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async getFreshness(): Promise<DataFreshnessResponse> {
    const tableProbeConfigs: TableProbeConfig[] = [
      // Zillow
      { tableName: 'zillow_state', dateColumn: 'period_date' },
      { tableName: 'zillow_county', dateColumn: 'period_date' },
      { tableName: 'zillow_city', dateColumn: 'period_date' },
      { tableName: 'zillow_metro', dateColumn: 'period_date' },
      { tableName: 'zillow_zip', dateColumn: 'period_date' },
      // Realtor
      { tableName: 'realtor_national', dateColumn: 'period_date' },
      { tableName: 'realtor_state', dateColumn: 'period_date' },
      { tableName: 'realtor_metro', dateColumn: 'period_date' },
      { tableName: 'realtor_county', dateColumn: 'period_date' },
      { tableName: 'realtor_zip', dateColumn: 'period_date' },
      // Redfin sales
      { tableName: 'redfin_national', dateColumn: 'period_end' },
      { tableName: 'redfin_state', dateColumn: 'period_end' },
      { tableName: 'redfin_metro', dateColumn: 'period_end' },
      { tableName: 'redfin_county', dateColumn: 'period_end' },
      // Redfin rentals
      { tableName: 'redfin_rental_national', dateColumn: 'period_date' },
      { tableName: 'redfin_rental_state', dateColumn: 'period_date' },
      { tableName: 'redfin_rental_metro', dateColumn: 'period_date' },
      { tableName: 'redfin_rental_county', dateColumn: 'period_date' },
      { tableName: 'redfin_rental_city', dateColumn: 'period_date' },
      { tableName: 'redfin_rental_zip', dateColumn: 'period_date' },
      // Census ACS
      { tableName: 'census_national', dateColumn: 'year' },
      { tableName: 'census_state', dateColumn: 'year' },
      { tableName: 'census_metro', dateColumn: 'year' },
      { tableName: 'census_county', dateColumn: 'year' },
      { tableName: 'census_city', dateColumn: 'year' },
      { tableName: 'census_zip', dateColumn: 'year' },
      // Permits (Census BPS)
      { tableName: 'permits_state', dateColumn: 'period_date' },
      { tableName: 'permits_county', dateColumn: 'period_date' },
      // Calculated / scores
      { tableName: 'calculated_metrics', dateColumn: 'period_date' },
      { tableName: 'propertyiq_scores', dateColumn: 'created_at' },
      // Economic
      { tableName: 'economic_national', dateColumn: 'period_date' },
      { tableName: 'economic_state', dateColumn: 'period_date' },
      { tableName: 'economic_metro', dateColumn: 'period_date' },
      { tableName: 'economic_county', dateColumn: 'period_date' },
    ];

    const tableEntries = await Promise.all(
      tableProbeConfigs.map(async (config) => [config.tableName, await this.getLatestDate(config)] as const),
    );
    const tableDates = Object.fromEntries(tableEntries);

    const zillowHistoricalByGeo = await this.getZillowDatesByGeo('historical');
    const zillowForecastByGeo = await this.getZillowDatesByGeo('forecast');
    const economicMetricDates = await this.getEconomicMetricDates();

    const sourceDates: Record<string, string | null> = {
      zillow: this.pickMostRecent(Object.values(zillowHistoricalByGeo)),
      zillow_forecast: this.pickMostRecent(Object.values(zillowForecastByGeo)),
      realtor: this.pickMostRecent([
        tableDates.realtor_national,
        tableDates.realtor_state,
        tableDates.realtor_metro,
        tableDates.realtor_county,
        tableDates.realtor_zip,
      ]),
      redfin: this.pickMostRecent([
        tableDates.redfin_national,
        tableDates.redfin_state,
        tableDates.redfin_metro,
        tableDates.redfin_county,
      ]),
      redfin_rental: this.pickMostRecent([
        tableDates.redfin_rental_national,
        tableDates.redfin_rental_state,
        tableDates.redfin_rental_metro,
        tableDates.redfin_rental_county,
        tableDates.redfin_rental_city,
        tableDates.redfin_rental_zip,
      ]),
      census_acs: this.pickMostRecent([
        tableDates.census_national,
        tableDates.census_state,
        tableDates.census_metro,
        tableDates.census_county,
        tableDates.census_city,
        tableDates.census_zip,
      ]),
      permits: this.pickMostRecent([tableDates.permits_state, tableDates.permits_county]),
      census: this.pickMostRecent([
        tableDates.census_national,
        tableDates.census_state,
        tableDates.census_metro,
        tableDates.census_county,
        tableDates.census_city,
        tableDates.census_zip,
        tableDates.permits_state,
        tableDates.permits_county,
      ]),
      calculated: tableDates.calculated_metrics ?? null,
      propertyiq: tableDates.propertyiq_scores ?? null,
      economic: this.pickMostRecent(
        Object.values(economicMetricDates).flatMap((byGeo) => Object.values(byGeo)),
      ),
      economic_unemployment: this.pickMostRecent(Object.values(economicMetricDates.unemployment_rate)),
      economic_job_growth: this.pickMostRecent(Object.values(economicMetricDates.employment_yoy)),
      economic_gdp_growth: this.pickMostRecent(Object.values(economicMetricDates.gdp_yoy)),
      economic_cost_of_living: this.pickMostRecent(Object.values(economicMetricDates.rpp_all_items)),
    };

    return {
      generatedAt: new Date().toISOString(),
      tableDates,
      sourceDates,
      zillowDates: {
        historicalByGeo: zillowHistoricalByGeo,
        forecastByGeo: zillowForecastByGeo,
      },
      economicMetricDates,
    };
  }

  private async getZillowDatesByGeo(
    mode: 'historical' | 'forecast',
  ): Promise<Record<Exclude<GeoFreshnessKey, 'national'>, string | null>> {
    const geos: Array<Exclude<GeoFreshnessKey, 'national'>> = ['state', 'metro', 'county', 'city', 'zip'];
    const entries = await Promise.all(
      geos.map(async (geo) => {
        const value = await this.getLatestDate({
          tableName: `zillow_${geo}`,
          dateColumn: 'period_date',
          filters: mode === 'forecast'
            ? [{ column: 'metric_name', op: 'eq', value: 'zhvf' }]
            : [{ column: 'metric_name', op: 'neq', value: 'zhvf' }],
        });
        return [geo, value] as const;
      }),
    );
    return Object.fromEntries(entries) as Record<Exclude<GeoFreshnessKey, 'national'>, string | null>;
  }

  private async getEconomicMetricDates(): Promise<DataFreshnessResponse['economicMetricDates']> {
    const metricColumns: EconomicMetricKey[] = [
      'unemployment_rate',
      'employment_yoy',
      'gdp_yoy',
      'rpp_all_items',
    ];
    const tableByGeo: Record<'national' | 'state' | 'metro' | 'county', string> = {
      national: 'economic_national',
      state: 'economic_state',
      metro: 'economic_metro',
      county: 'economic_county',
    };

    const result = {} as DataFreshnessResponse['economicMetricDates'];

    for (const metric of metricColumns) {
      const geoEntries = await Promise.all(
        (Object.entries(tableByGeo) as Array<[keyof typeof tableByGeo, string]>).map(async ([geo, tableName]) => {
          const value = await this.getLatestDate({
            tableName,
            dateColumn: 'period_date',
            filters: [{ column: metric, op: 'notNull' }],
          });
          return [geo, value] as const;
        }),
      );
      result[metric] = Object.fromEntries(geoEntries);
    }

    return result;
  }

  private async getLatestDate(config: TableProbeConfig): Promise<string | null> {
    const client = this.supabase.getClient();
    try {
      let query = client
        .from(config.tableName)
        .select(config.dateColumn)
        .order(config.dateColumn, { ascending: false })
        .limit(1);

      for (const filter of config.filters || []) {
        if (filter.op === 'eq') {
          query = query.eq(filter.column, filter.value as string);
        } else if (filter.op === 'neq') {
          query = query.neq(filter.column, filter.value as string);
        } else if (filter.op === 'notNull') {
          query = query.not(filter.column, 'is', null);
        }
      }

      const { data, error } = await query;
      if (error) {
        this.logger.warn(`Freshness probe failed for ${config.tableName}: ${error.message}`);
        return null;
      }

      const rawValue = data?.[0]?.[config.dateColumn];
      return this.normalizeDateValue(rawValue);
    } catch (error) {
      this.logger.warn(`Freshness probe exception for ${config.tableName}: ${String(error)}`);
      return null;
    }
  }

  private normalizeDateValue(value: unknown): string | null {
    if (value == null) return null;
    const str = String(value).trim();
    if (!str) return null;

    if (/^\d{4}$/.test(str)) return str;
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    if (/^\d{4}-\d{2}-\d{2}T/.test(str)) return str.slice(0, 10);

    const parsed = new Date(str);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }

    return str;
  }

  private pickMostRecent(values: Array<string | null | undefined>): string | null {
    let best: { raw: string; ts: number } | null = null;
    for (const value of values) {
      if (!value) continue;
      const ts = this.dateSortValue(value);
      if (ts == null) continue;
      if (!best || ts > best.ts) {
        best = { raw: value, ts };
      }
    }
    return best?.raw ?? null;
  }

  private dateSortValue(value: string): number | null {
    if (/^\d{4}$/.test(value)) {
      return Date.UTC(Number(value), 0, 1);
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.getTime();
  }
}
