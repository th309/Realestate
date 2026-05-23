import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { SupabaseService } from '../../supabase/supabase.service';
import { getIncrementalCutoff } from '../utils/incremental-cutoff';
import {
  IngestionLogger,
  batchUpsertWithRetry,
  buildErrorSummary,
  determineOverallStatus,
  reportPipelineStatus,
  validateMetricValue,
} from '../base';

const FRED_API_BASE = 'https://api.stlouisfed.org/fred/series/observations';
const UNITED_STATES_REGION_ID = '102001';
const ECONOMIC_NATIONAL_TABLE = 'economic_national';

interface FREDResponse {
  observations: {
    date: string;
    value: string;
  }[];
  realtime_start: string;
  realtime_end: string;
}

const FRED_SERIES = {
  mortgage_rate_30yr: {
    series_id: 'MORTGAGE30US',
    metric_name: 'mortgage_rate_30yr',
    description: '30-Year Fixed Rate Mortgage Average',
  },
  mortgage_rate_15yr: {
    series_id: 'MORTGAGE15US',
    metric_name: 'mortgage_rate_15yr',
    description: '15-Year Fixed Rate Mortgage Average',
  },
  unemployment_rate: {
    series_id: 'UNRATE',
    metric_name: 'unemployment_rate',
    description: 'Unemployment Rate',
  },
};

@Injectable()
export class FredService {
  private readonly logger = new Logger(FredService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async importFREDData(
    seriesKeys: string[] = ['mortgage_rate_30yr'],
    apiKey?: string,
    fullLoad: boolean = false,
  ): Promise<any> {
    const supabase = this.supabaseService.getClient();
    const fredApiKey = apiKey || process.env.FRED_API_KEY;

    if (!fredApiKey) {
      throw new Error(
        'FRED API key is required. Set FRED_API_KEY environment variable or pass as parameter.',
      );
    }

    // FRED supports server-side date filtering, so the cutoff cuts BOTH network
    // and DB writes. Backfill uses 2000-01-01 (the original hardcoded value).
    const observationStart =
      getIncrementalCutoff({ frequency: 'monthly', fullLoad }) ?? '2000-01-01';

    this.logger.log(
      `Starting FRED import for: ${seriesKeys.join(', ')} ` +
        `(mode: ${fullLoad ? 'FULL backfill' : `incremental >= ${observationStart}`})`,
    );

    const startedAt = Date.now();
    const ingestionLogger = new IngestionLogger(
      supabase,
      'fred',
      seriesKeys.join(','),
    );

    // Ensure United States region exists
    const { error: marketError } = await supabase.from('markets').upsert(
      {
        region_id: UNITED_STATES_REGION_ID,
        region_name: 'United States',
        region_type: 'country',
      },
      {
        onConflict: 'region_id',
        ignoreDuplicates: false,
      },
    );

    if (marketError) {
      this.logger.warn(
        `Could not ensure United States region exists: ${marketError.message}`,
      );
    } else {
      this.logger.log('United States region verified');
    }

    let totalRecordsInserted = 0;
    let totalValidationErrors = 0;
    const errors: any[] = [];

    for (const seriesKey of seriesKeys) {
      const series = FRED_SERIES[seriesKey as keyof typeof FRED_SERIES];

      if (!series) {
        this.logger.warn(`Unknown series: ${seriesKey}`);
        continue;
      }

      try {
        this.logger.log(
          `Fetching ${series.description} (${series.series_id})...`,
        );

        const url = `${FRED_API_BASE}?series_id=${series.series_id}&api_key=${fredApiKey}&file_type=json&observation_start=${observationStart}`;

        const response = await axios.get<FREDResponse>(url, {
          timeout: 30000,
        });

        const observations = response.data.observations || [];
        this.logger.log(`Fetched ${observations.length} observations`);

        // Validate + shape into the wide-format economic_national rows
        const recordsToUpsert: Array<Record<string, unknown>> = [];
        let seriesValidationErrors = 0;

        for (const obs of observations) {
          const value = parseFloat(obs.value);
          if (isNaN(value) || obs.value === '.') continue;

          if (!validateMetricValue('fred', series.metric_name, value)) {
            this.logger.warn(
              `Out-of-range FRED value for ${series.metric_name} [${obs.date}]: ${value}`,
            );
            seriesValidationErrors++;
            continue;
          }

          recordsToUpsert.push({
            region_id: UNITED_STATES_REGION_ID,
            period_date: obs.date,
            [series.metric_name]: value,
          });
        }
        totalValidationErrors += seriesValidationErrors;

        this.logger.log(
          `Prepared ${recordsToUpsert.length} records for insertion`,
        );

        if (recordsToUpsert.length > 0) {
          const upsertResult = await batchUpsertWithRetry(
            supabase,
            recordsToUpsert,
            {
              tableName: ECONOMIC_NATIONAL_TABLE,
              onConflict: 'region_id,period_date',
            },
          );

          totalRecordsInserted += upsertResult.inserted;
          for (const errMessage of upsertResult.errors) {
            this.logger.error(
              `Error upserting batch to ${ECONOMIC_NATIONAL_TABLE}: ${errMessage}`,
            );
            errors.push({ series: seriesKey, error: errMessage });
          }

          this.logger.log(
            `Successfully imported ${upsertResult.inserted} records for ${series.description}`,
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error: any) {
        this.logger.error(
          `Error fetching ${series.description}: ${error.message}`,
        );
        errors.push({
          series: seriesKey,
          error: error.message,
        });
      }
    }

    this.logger.log(
      `FRED Import Summary: Total records inserted: ${totalRecordsInserted}, Validation errors: ${totalValidationErrors}`,
    );
    if (errors.length > 0) {
      this.logger.error(`Errors: ${errors.length}`);
    }

    const overallStatus = determineOverallStatus(
      errors.length,
      totalValidationErrors,
      totalRecordsInserted,
    );
    const errorSummary = buildErrorSummary(
      errors.length,
      totalValidationErrors,
      totalRecordsInserted,
    );

    await ingestionLogger.log({
      status: overallStatus,
      recordsProcessed: totalRecordsInserted + totalValidationErrors,
      recordsInserted: totalRecordsInserted,
      errorMessage: errorSummary,
    });

    await reportPipelineStatus(
      'fred',
      overallStatus,
      totalRecordsInserted,
      errors.length + totalValidationErrors,
      Date.now() - startedAt,
      [
        {
          id: ECONOMIC_NATIONAL_TABLE,
          table: ECONOMIC_NATIONAL_TABLE,
          status: overallStatus,
          inserted: totalRecordsInserted,
          failed: errors.length + totalValidationErrors,
        },
      ],
    );

    return {
      success: overallStatus === 'success',
      recordsInserted: totalRecordsInserted,
      validationErrors: totalValidationErrors,
      errors,
      message: errorSummary
        ? `Imported FRED data: ${totalRecordsInserted} records. ${errorSummary}`
        : `Imported FRED data: ${totalRecordsInserted} records`,
    };
  }
}
