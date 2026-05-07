import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { parse as parseSync } from 'csv-parse/sync';
import { SupabaseService } from '../../supabase/supabase.service';
import { ZILLOW_URLS } from '../config/zillow-urls';
import { ImportResult, TimeSeriesRecord } from '../types';
import { normalizeZipKey } from '../../common/zip';

const PIPELINE_API_URL =
  process.env.INTERNAL_API_URL || 'http://localhost:3001';

async function reportPipelineStatus(
  source: string,
  status: 'success' | 'partial' | 'failed',
  totalInserted: number,
  totalFailed: number,
  durationMs: number,
  geographies: Array<{
    id: string;
    table: string;
    status: 'success' | 'partial' | 'failed' | 'skipped';
    inserted: number;
    failed: number;
  }>,
): Promise<void> {
  const apiKey = process.env.PIPELINE_API_KEY;
  if (!apiKey) return;
  try {
    await fetch(`${PIPELINE_API_URL}/api/health/pipeline-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        source,
        status,
        totalInserted,
        totalFailed,
        durationMs,
        geographies,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    /* fire-and-forget: never block import on reporting failure */
  }
}

const VALID_RANGES: Record<string, [number, number]> = {
  zhvi: [10_000, 10_000_000],
  zori: [200, 20_000],
  zordi: [200, 20_000],
  yoy_change: [-0.5, 1.0],
  unemployment_rate: [0, 30],
  population: [100, 50_000_000],
};

function validateTimeSeriesValue(metricName: string, value: number): boolean {
  const range = VALID_RANGES[metricName];
  if (!range) return true; // No defined range — pass through
  return value >= range[0] && value <= range[1];
}

/**
 * Normalize metric key to base metric name for database storage.
 * e.g., 'zori_county' → 'zori', 'zordi' → 'zordi'
 */
function normalizeMetricName(metricKey: string): string {
  // Strip geography suffixes like _county, _zip, _state
  const baseName = metricKey.replace(/_(county|zip|state|metro|city)$/, '');
  return baseName;
}

interface MarketRecord {
  region_id: string;
  region_name: string;
  region_type: string;
  state_name?: string;
  state_code?: string;
  size_rank?: number;
}

@Injectable()
export class ZillowService {
  private readonly logger = new Logger(ZillowService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async importZillowData(
    metricName: string = 'zhvi',
    limitRows?: number,
  ): Promise<ImportResult> {
    const supabase = this.supabaseService.getClient();

    this.logger.log(`Starting Zillow import for: ${metricName}`);

    // Download CSV
    const url = ZILLOW_URLS[metricName];
    if (!url) {
      throw new Error(`Unknown metric: ${metricName}`);
    }

    this.logger.log(`Downloading from: ${url}`);

    const startedAt = Date.now();

    try {
      const response = await axios.get(url, {
        timeout: 30000,
        maxContentLength: 50 * 1024 * 1024,
      });

      this.logger.log(
        `Downloaded ${(response.data.length / 1024).toFixed(1)} KB`,
      );

      // Parse CSV
      const records: any[] = parseSync(response.data, {
        columns: true,
        skip_empty_lines: true,
      });

      this.logger.log(`Parsed ${records.length} regions`);

      // Limit rows if specified
      const recordsToProcess = limitRows
        ? records.slice(0, limitRows)
        : records;
      this.logger.log(`Processing ${recordsToProcess.length} regions`);

      let marketsCreated = 0;
      let timeSeriesInserted = 0;
      let errors = 0;
      let validationErrors = 0;
      const errorDetails: any[] = [];

      for (const [index, record] of recordsToProcess.entries()) {
        try {
          // Extract metadata columns
          const regionId = record.RegionID;
          const regionType =
            record.RegionType === 'msa' ? 'msa' : record.RegionType;
          const regionName =
            regionType === 'zip' || regionType === 'Zip'
              ? normalizeZipKey(record.RegionName || '')
              : record.RegionName || '';
          const stateName = record.StateName || null;
          const sizeRank = record.SizeRank ? parseInt(record.SizeRank) : null;

          if (!regionId || !regionName) {
            this.logger.warn(
              `Skipping row ${index}: missing RegionID or RegionName`,
            );
            continue;
          }

          if ((index + 1) % 10 === 0) {
            this.logger.debug(
              `Processing region ${index + 1}/${recordsToProcess.length}: ${regionName}`,
            );
          }

          // Step 1: Upsert market record (regionName already normalized for zip)
          const marketData: MarketRecord = {
            region_id: regionId,
            region_name: regionName,
            region_type: regionType,
            state_name: stateName || undefined,
            state_code: stateName
              ? stateName.substring(0, 2).toUpperCase()
              : undefined,
            size_rank: sizeRank || undefined,
          };

          const { error: marketError } = await supabase
            .from('markets')
            .upsert(marketData, {
              onConflict: 'region_id',
              ignoreDuplicates: false,
            });

          if (marketError) {
            this.logger.error(
              `Error upserting market ${regionId}: ${marketError.message}`,
            );
            errors++;
            continue;
          }

          marketsCreated++;

          // Determine target table based on region type
          let tableName = '';
          switch (regionType) {
            case 'state':
              tableName = 'zillow_state';
              break;
            case 'msa':
              tableName = 'zillow_metro';
              break;
            case 'county':
              tableName = 'zillow_county';
              break;
            case 'zip':
              tableName = 'zillow_zip';
              break;
            case 'city':
              tableName = 'zillow_city';
              break;
            default:
              this.logger.warn(
                `Skipping unsupported region type: ${regionType}`,
              );
              continue;
          }

          // Prepare batch for insertion
          const recordsToInsert: any[] = [];

          // Get all date columns (format: YYYY-MM-DD)
          const dateColumns = Object.keys(record).filter((key) =>
            /^\d{4}-\d{2}-\d{2}$/.test(key),
          );

          // Normalize metric name for storage (e.g., 'zori_county' → 'zori')
          const normalizedMetricName = normalizeMetricName(metricName);

          for (const dateCol of dateColumns) {
            const value = parseFloat(record[dateCol]);

            // Skip null/empty values
            if (!isNaN(value) && value !== null && value !== 0) {
              if (!validateTimeSeriesValue(normalizedMetricName, value)) {
                this.logger.warn(
                  `Out-of-range value for ${normalizedMetricName} [${regionId}/${dateCol}]: ${value}`,
                );
                validationErrors++;
                continue;
              }
              recordsToInsert.push({
                region_id: regionId,
                region_name: regionName,
                period_date: dateCol,
                metric_name: normalizedMetricName,
                value: value,
              });
            }
          }

          if (recordsToInsert.length > 0) {
            const batchSize = 100;
            for (let i = 0; i < recordsToInsert.length; i += batchSize) {
              const batch = recordsToInsert.slice(i, i + batchSize);

              try {
                const { data: tsResult, error: tsError } = await supabase
                  .from(tableName)
                  .upsert(batch, {
                    onConflict: 'region_id,period_date,metric_name',
                    ignoreDuplicates: false,
                  })
                  .select();

                if (tsError) {
                  this.logger.error(
                    `Error upserting batch to ${tableName} for ${regionId}: ${tsError.message}`,
                  );
                  errorDetails.push({
                    region: regionId,
                    error: tsError.message,
                    code: tsError.code,
                  });
                  errors++;
                } else {
                  timeSeriesInserted += tsResult?.length || batch.length;
                }
              } catch (err: any) {
                this.logger.error(
                  `Exception during upsert for ${regionId}: ${err.message}`,
                );
                errors++;
              }
            }
          }
        } catch (error: any) {
          this.logger.error(
            `Error processing region ${index}: ${error.message}`,
          );
          errors++;
        }
      }

      this.logger.log(
        `Import Summary: Markets created: ${marketsCreated}, Time series inserted: ${timeSeriesInserted}, Errors: ${errors}, Validation errors: ${validationErrors}`,
      );

      const totalAttempted = timeSeriesInserted + validationErrors;
      const validationErrorRate =
        totalAttempted > 0 ? validationErrors / totalAttempted : 0;
      const hasHighValidationErrorRate = validationErrorRate > 0.05;

      let overallStatus: 'success' | 'partial' | 'failed';
      if (errors === 0 && validationErrors === 0) {
        overallStatus = 'success';
      } else if (timeSeriesInserted > 0) {
        overallStatus = 'partial';
      } else {
        overallStatus = 'failed';
      }

      const errorSummary = [
        errors > 0 ? `${errors} DB errors` : null,
        hasHighValidationErrorRate
          ? `${validationErrors} validation errors (${(validationErrorRate * 100).toFixed(1)}% of records out of range)`
          : validationErrors > 0
            ? `${validationErrors} validation errors`
            : null,
      ]
        .filter(Boolean)
        .join('; ');

      // Log to data_ingestion_logs
      await supabase.from('data_ingestion_logs').insert({
        source: 'zillow',
        dataset: metricName,
        status: overallStatus,
        records_processed: recordsToProcess.length,
        records_inserted: timeSeriesInserted,
        error_message: errorSummary || null,
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
