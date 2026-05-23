import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  CensusGeoLevel,
  ImportResult,
  CENSUS_API_BASE,
  CENSUS_VARIABLES,
} from '../types';
import { getIncrementalCutoff } from '../utils/incremental-cutoff';
import {
  IngestionLogger,
  determineOverallStatus,
  reportPipelineStatus,
} from '../base';
import { resolveOrCreateMarket } from './census-geo-resolver';

const TABLE_BY_GEO_LEVEL: Record<CensusGeoLevel, string> = {
  state: 'census_state',
  'metropolitan statistical area/micropolitan statistical area': 'census_metro',
  place: 'census_city',
  'zip code tabulation area': 'census_zip',
};

@Injectable()
export class CensusService {
  private readonly logger = new Logger(CensusService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async importCensusData(
    variables: string[] = ['population', 'median_household_income'],
    year: number = 2022,
    geoLevel: CensusGeoLevel = 'metropolitan statistical area/micropolitan statistical area',
    apiKey?: string,
    fullLoad: boolean = false,
  ): Promise<ImportResult> {
    const supabase = this.supabaseService.getClient();
    const censusApiKey = apiKey || process.env.CENSUS_API_KEY;

    if (!censusApiKey) {
      throw new Error(
        'Census API key is required. Set CENSUS_API_KEY environment variable or pass as parameter.',
      );
    }

    this.logger.log(`Starting Census import for: ${variables.join(', ')}`);
    this.logger.log(`Year: ${year}, Geographic Level: ${geoLevel}`);

    const tableName = TABLE_BY_GEO_LEVEL[geoLevel];
    if (!tableName) {
      throw new Error(`Unsupported census geography: ${geoLevel}`);
    }

    // Annual data: only re-fetch the last 2 vintages (covers new releases and
    // ACS revisions). Older vintages already in DB are skipped unless fullLoad.
    const annualCutoff = getIncrementalCutoff({
      frequency: 'annual',
      fullLoad,
    });
    const cutoffYear = annualCutoff
      ? parseInt(annualCutoff.slice(0, 4), 10)
      : null;

    if (!fullLoad && cutoffYear !== null && year < cutoffYear) {
      const { count } = await supabase
        .from(tableName)
        .select('region_id', { count: 'exact', head: true })
        .eq('year', year);
      if (count && count > 0) {
        this.logger.log(
          `Census ${year} already loaded into ${tableName} (${count} rows) and ` +
            `outside incremental window (>= ${cutoffYear}); skipping. ` +
            `Pass fullLoad=true to force re-import.`,
        );
        return {
          success: true,
          recordsInserted: 0,
          errors: [],
          message: `Census ${year}/${geoLevel} skipped — outside annual incremental window`,
        };
      }
    }

    const startedAt = Date.now();
    const ingestionLogger = new IngestionLogger(
      supabase,
      'census',
      `${geoLevel}:${year}`,
    );

    const variablesList = variables
      .map((v) => CENSUS_VARIABLES[v])
      .filter(Boolean)
      .map((v) => v.variable)
      .join(',');

    const variableMetrics = variables
      .map((v) => CENSUS_VARIABLES[v])
      .filter(Boolean);

    let totalRecordsInserted = 0;
    const errors: any[] = [];

    try {
      const url = `${CENSUS_API_BASE}/${year}/acs/acs5?get=${variablesList},NAME&for=${geoLevel}:*&key=${censusApiKey}`;
      this.logger.log(`Fetching Census data from: ${url.substring(0, 100)}...`);

      const response = await axios.get<any>(url, { timeout: 60000 });
      const data = response.data;
      if (!Array.isArray(data) || data.length < 2) {
        throw new Error('Invalid Census API response format');
      }

      const headers = data[0];
      const rows = data.slice(1);
      this.logger.log(`Fetched ${rows.length} geographic areas`);

      for (const row of rows) {
        try {
          const record: Record<string, string> = {};
          headers.forEach((header: string, index: number) => {
            record[header] = row[index];
          });

          const name = record['NAME'] || '';
          const geoCode = record[geoLevel] || '';
          if (!name || !geoCode) continue;

          const regionId = await resolveOrCreateMarket(
            supabase,
            this.logger,
            name,
            geoCode,
            geoLevel,
            record,
          );
          if (!regionId) {
            this.logger.warn(
              `Could not create or map Census geography: ${name} (${geoCode})`,
            );
            continue;
          }

          // Build wide-format row: one column per metric for this region+year.
          const censusRecord: Record<string, any> = {
            region_id: regionId,
            year,
          };
          let hasValidMetrics = false;
          for (const metric of variableMetrics) {
            const value = parseFloat(record[metric.variable]);
            if (!isNaN(value) && value !== null) {
              const colName =
                metric.metric_name === 'population'
                  ? 'total_population'
                  : metric.metric_name;
              censusRecord[colName] = value;
              hasValidMetrics = true;
            }
          }

          if (!hasValidMetrics) continue;

          const { error } = await supabase
            .from(tableName)
            .upsert(censusRecord, {
              onConflict: 'region_id,year',
              ignoreDuplicates: false,
            });

          if (error) {
            this.logger.error(
              `Error upserting census record for ${name}: ${error.message}`,
            );
            errors.push({ geography: name, error: error.message });
          } else {
            totalRecordsInserted++;
          }
        } catch (error: any) {
          this.logger.error(`Error processing row: ${error.message}`);
          errors.push({ error: error.message });
        }
      }

      this.logger.log(
        `Census Import Summary: Total records inserted: ${totalRecordsInserted}`,
      );
      if (errors.length > 0) {
        this.logger.error(`Errors: ${errors.length}`);
      }

      const overallStatus = determineOverallStatus(
        errors.length,
        0,
        totalRecordsInserted,
      );

      await ingestionLogger.log({
        status: overallStatus,
        recordsProcessed: rows.length,
        recordsInserted: totalRecordsInserted,
        errorMessage: errors.length > 0 ? `${errors.length} DB errors` : null,
      });

      await reportPipelineStatus(
        'census',
        overallStatus,
        totalRecordsInserted,
        errors.length,
        Date.now() - startedAt,
        [
          {
            id: geoLevel,
            table: tableName,
            status: overallStatus,
            inserted: totalRecordsInserted,
            failed: errors.length,
          },
        ],
      );

      return {
        success: errors.length === 0,
        recordsInserted: totalRecordsInserted,
        errors,
        message: `Imported Census data: ${totalRecordsInserted} records`,
      };
    } catch (error: any) {
      this.logger.error(`Error fetching Census data: ${error.message}`);
      await reportPipelineStatus(
        'census',
        'failed',
        0,
        1,
        Date.now() - startedAt,
        [
          {
            id: geoLevel,
            table: tableName,
            status: 'failed',
            inserted: 0,
            failed: 1,
          },
        ],
      );
      throw error;
    }
  }
}
