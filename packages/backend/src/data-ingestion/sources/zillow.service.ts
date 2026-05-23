import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { parse as parseSync } from 'csv-parse/sync';
import { SupabaseService } from '../../supabase/supabase.service';
import { ZILLOW_URLS } from '../config/zillow-urls';
import { ImportResult } from '../types';
import { getIncrementalCutoff } from '../utils/incremental-cutoff';
import {
  IngestionLogger,
  buildErrorSummary,
  determineOverallStatus,
  reportPipelineStatus,
} from '../base';
import { processZillowRegion } from './zillow-region-processor';

/**
 * Strip geography suffixes from the metric key so the DB stores the
 * canonical name. e.g. 'zori_county' → 'zori', 'zhvi' → 'zhvi'.
 */
function normalizeMetricName(metricKey: string): string {
  return metricKey.replace(/_(county|zip|state|metro|city)$/, '');
}

@Injectable()
export class ZillowService {
  private readonly logger = new Logger(ZillowService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async importZillowData(
    metricName: string = 'zhvi',
    limitRows?: number,
    fullLoad: boolean = false,
  ): Promise<ImportResult> {
    const supabase = this.supabaseService.getClient();

    // Default: incremental (last 3 months). Pass fullLoad=true for backfill.
    // Zillow ZHVI revises the trailing ~2 months on most releases, so a 3-month
    // window catches revisions; the upsert dedupes unchanged rows for free.
    const dateCutoff = getIncrementalCutoff({
      frequency: 'monthly',
      fullLoad,
    });

    this.logger.log(
      `Starting Zillow import for: ${metricName} (mode: ${
        fullLoad ? 'FULL backfill' : `incremental >= ${dateCutoff}`
      })`,
    );

    const url = ZILLOW_URLS[metricName];
    if (!url) {
      throw new Error(`Unknown metric: ${metricName}`);
    }

    this.logger.log(`Downloading from: ${url}`);

    const startedAt = Date.now();
    const ingestionLogger = new IngestionLogger(supabase, 'zillow', metricName);

    try {
      const response = await axios.get(url, {
        timeout: 30000,
        maxContentLength: 50 * 1024 * 1024,
      });

      this.logger.log(
        `Downloaded ${(response.data.length / 1024).toFixed(1)} KB`,
      );

      const records: any[] = parseSync(response.data, {
        columns: true,
        skip_empty_lines: true,
      });

      this.logger.log(`Parsed ${records.length} regions`);

      const recordsToProcess = limitRows
        ? records.slice(0, limitRows)
        : records;
      this.logger.log(`Processing ${recordsToProcess.length} regions`);

      const normalizedMetricName = normalizeMetricName(metricName);

      let marketsCreated = 0;
      let timeSeriesInserted = 0;
      let errors = 0;
      let validationErrors = 0;
      const errorDetails: any[] = [];

      for (const [index, record] of recordsToProcess.entries()) {
        const regionResult = await processZillowRegion(
          supabase,
          this.logger,
          record,
          index,
          recordsToProcess.length,
          normalizedMetricName,
          dateCutoff,
        );
        marketsCreated += regionResult.marketsCreated;
        timeSeriesInserted += regionResult.timeSeriesInserted;
        errors += regionResult.errors;
        validationErrors += regionResult.validationErrors;
        errorDetails.push(...regionResult.errorDetails);
      }

      this.logger.log(
        `Import Summary: Markets created: ${marketsCreated}, Time series inserted: ${timeSeriesInserted}, Errors: ${errors}, Validation errors: ${validationErrors}`,
      );

      const overallStatus = determineOverallStatus(
        errors,
        validationErrors,
        timeSeriesInserted,
      );
      const errorSummary = buildErrorSummary(
        errors,
        validationErrors,
        timeSeriesInserted,
      );

      await ingestionLogger.log({
        status: overallStatus,
        recordsProcessed: recordsToProcess.length,
        recordsInserted: timeSeriesInserted,
        errorMessage: errorSummary,
      });

      await reportPipelineStatus(
        'zillow',
        overallStatus,
        timeSeriesInserted,
        errors + validationErrors,
        Date.now() - startedAt,
        [
          {
            id: metricName,
            table: 'zillow',
            status: overallStatus,
            inserted: timeSeriesInserted,
            failed: errors + validationErrors,
          },
        ],
      );

      return {
        success: overallStatus === 'success',
        message: `Imported ${metricName}: ${marketsCreated} markets, ${timeSeriesInserted} records`,
        details: {
          marketsCreated,
          timeSeriesInserted,
          errors,
          validationErrors,
          errorDetails,
        },
      };
    } catch (error: any) {
      this.logger.error(
        `Error downloading or parsing Zillow data: ${error.message}`,
      );
      await reportPipelineStatus(
        'zillow',
        'failed',
        0,
        1,
        Date.now() - startedAt,
        [
          {
            id: metricName,
            table: 'zillow',
            status: 'failed',
            inserted: 0,
            failed: 1,
          },
        ],
      );
      throw error;
    }
  }

  async testZillowImport() {
    return this.importZillowData('zhvi', 50);
  }
}
