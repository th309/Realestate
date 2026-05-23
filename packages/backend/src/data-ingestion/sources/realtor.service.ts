import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { SupabaseService } from '../../supabase/supabase.service';
import { REALTOR_DATASETS } from '../config/realtor.config';
import { ImportResult } from '../types';
import { getIncrementalCutoff } from '../utils/incremental-cutoff';
import {
  IngestionLogger,
  batchUpsertWithRetry,
  determineOverallStatus,
  reportPipelineStatus,
} from '../base';
import {
  parseCountyCoreCSV,
  parseHotnessData,
  parseMetroCoreCSV,
  parseNationalCSV,
  parseStateCSV,
  parseZipCoreCSV,
  mergeHotnessData,
} from './realtor-parsers';

const CONFLICT_KEY_BY_GEOGRAPHY: Record<string, string> = {
  national: 'period_date',
  state: 'period_date,state_id',
  metro: 'period_date,cbsa_code',
  county: 'period_date,county_fips',
  zip: 'period_date,postal_code',
};

@Injectable()
export class RealtorService {
  private readonly logger = new Logger(RealtorService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async importAllRealtorData(
    limitRows?: number,
    fullLoad: boolean = false,
  ): Promise<ImportResult[]> {
    const results: ImportResult[] = [];
    for (const dataset of REALTOR_DATASETS) {
      results.push(await this.importDataset(dataset.id, limitRows, fullLoad));
    }
    return results;
  }

  async importDataset(
    datasetId: string,
    limitRows?: number,
    fullLoad: boolean = false,
  ): Promise<ImportResult> {
    const config = REALTOR_DATASETS.find((d) => d.id === datasetId);
    if (!config) {
      throw new Error(`Unknown dataset ID: ${datasetId}`);
    }

    const supabase = this.supabaseService.getClient();
    const startedAt = Date.now();
    const ingestionLogger = new IngestionLogger(supabase, 'realtor', datasetId);

    // Realtor publishes cumulative CSVs with years of history. Filter to the
    // last 3 months by default so we don't re-upsert unchanged rows. Realtor
    // can revise the prior month, so the overlap window catches that.
    const dateCutoffStr = getIncrementalCutoff({
      frequency: 'monthly',
      fullLoad,
    });
    const dateCutoff = dateCutoffStr ? new Date(dateCutoffStr) : null;

    this.logger.log(
      `Starting import for ${config.description} (${datasetId}) — ` +
        `mode: ${fullLoad ? 'FULL backfill' : `incremental >= ${dateCutoffStr}`}`,
    );

    try {
      this.logger.log(`Downloading core data from ${config.downloadUrl}...`);
      const coreCsv = await this.downloadCsv(config.downloadUrl);

      let hotnessMap = new Map<string, any>();
      if (config.hotnessUrl) {
        this.logger.log(
          `Downloading hotness data from ${config.hotnessUrl}...`,
        );
        const hotnessCsv = await this.downloadCsv(config.hotnessUrl);
        hotnessMap = parseHotnessData(hotnessCsv, config.geography);
      }

      let records: any[] = this.parseAndMerge(
        coreCsv,
        config.geography,
        hotnessMap,
      );

      if (dateCutoff) {
        const before = records.length;
        records = records.filter((r) => r.period_date >= dateCutoff);
        this.logger.log(
          `Filtered to incremental window: ${before} -> ${records.length} rows (cutoff ${dateCutoffStr})`,
        );
      }

      if (limitRows) records = records.slice(0, limitRows);

      this.logger.log(
        `Parsed ${records.length} records. Inserting into ${config.tableName}...`,
      );

      // Stringify Date objects for Supabase
      const formatted = records.map((r) => ({
        ...r,
        period_date: r.period_date.toISOString().split('T')[0],
      }));

      const onConflict =
        CONFLICT_KEY_BY_GEOGRAPHY[config.geography] ?? 'period_date';

      const upsertResult = await batchUpsertWithRetry(supabase, formatted, {
        tableName: config.tableName,
        onConflict,
        batchSize: 1000,
      });

      for (const errMessage of upsertResult.errors) {
        this.logger.error(
          `Batch insert error for ${config.tableName}: ${errMessage}`,
        );
      }

      const overallStatus = determineOverallStatus(
        upsertResult.errors.length,
        0,
        upsertResult.inserted,
      );

      await ingestionLogger.log({
        status: overallStatus,
        recordsProcessed: records.length,
        recordsInserted: upsertResult.inserted,
        errorMessage:
          upsertResult.failed > 0
            ? `${upsertResult.failed} records failed to insert`
            : null,
      });

      await reportPipelineStatus(
        'realtor',
        overallStatus,
        upsertResult.inserted,
        upsertResult.failed,
        Date.now() - startedAt,
        [
          {
            id: datasetId,
            table: config.tableName,
            status: overallStatus,
            inserted: upsertResult.inserted,
            failed: upsertResult.failed,
          },
        ],
      );

      return {
        success: upsertResult.failed === 0,
        message: `Imported ${config.tableName}: ${upsertResult.inserted} records`,
        recordsInserted: upsertResult.inserted,
        errors:
          upsertResult.failed > 0
            ? [
                {
                  message: `${upsertResult.failed} records failed to insert`,
                },
              ]
            : [],
      };
    } catch (error: any) {
      this.logger.error(`Error importing ${datasetId}: ${error.message}`);
      await reportPipelineStatus(
        'realtor',
        'failed',
        0,
        1,
        Date.now() - startedAt,
        [
          {
            id: datasetId,
            table: config.tableName,
            status: 'failed',
            inserted: 0,
            failed: 1,
          },
        ],
      );
      return {
        success: false,
        message: `Failed to import ${datasetId}: ${error.message}`,
        errors: [error.message],
      };
    }
  }

  private parseAndMerge(
    coreCsv: string,
    geography: string,
    hotnessMap: Map<string, any>,
  ): any[] {
    switch (geography) {
      case 'national':
        return parseNationalCSV(coreCsv);
      case 'state':
        return parseStateCSV(coreCsv);
      case 'metro': {
        let records = parseMetroCoreCSV(coreCsv);
        if (hotnessMap.size > 0)
          records = mergeHotnessData(records, hotnessMap, 'cbsa_code');
        return records;
      }
      case 'county': {
        let records = parseCountyCoreCSV(coreCsv);
        if (hotnessMap.size > 0)
          records = mergeHotnessData(records, hotnessMap, 'county_fips');
        return records;
      }
      case 'zip': {
        let records = parseZipCoreCSV(coreCsv);
        if (hotnessMap.size > 0)
          records = mergeHotnessData(records, hotnessMap, 'postal_code');
        return records;
      }
      default:
        throw new Error(`Unsupported geography: ${geography}`);
    }
  }

  private async downloadCsv(url: string): Promise<string> {
    const response = await axios.get(url, {
      timeout: 120000,
      maxContentLength: 500 * 1024 * 1024,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    return response.data;
  }
}
