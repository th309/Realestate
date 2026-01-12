/**
 * Base Zillow Data Importer
 *
 * Shared logic for importing Zillow data into long-format tables.
 * Each geography level has its own table:
 * - zillow_state
 * - zillow_metro
 * - zillow_county
 * - zillow_zip
 *
 * All tables use the same structure:
 * - region_id: Zillow's RegionID (integer)
 * - region_name: Display name
 * - state_code: State abbreviation (where applicable)
 * - period_date: Date of the data point
 * - metric_name: 'zhvi', 'zori', 'inventory', etc.
 * - value: The metric value
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';
import { parse } from 'csv-parse/sync';

// Load environment variables
config({ path: join(__dirname, '../../packages/backend/.env') });

export interface ZillowRecord {
  region_id: number;
  region_name: string;
  state_code: string | null;
  cbsa_code?: string | null;
  fips_code?: string | null;
  period_date: string;
  metric_name: string;
  value: number;
}

export interface ImportResult {
  geography: string;
  metricName: string;
  recordsProcessed: number;
  recordsInserted: number;
  recordsUpdated: number;
  errors: string[];
  duration: number;
}

export type GeographyLevel = 'State' | 'Metro' | 'County' | 'Zip' | 'City';
export type MetricName = 'zhvi' | 'zhvi_yoy' | 'zori' | 'zori_yoy' | 'inventory' | 'inventory_yoy' |
  'dom' | 'sale_price' | 'list_price' | 'new_listings' | 'pending_sales' |
  'sale_to_list' | 'price_cuts' | 'zhvf_1m' | 'zhvf_3m' | 'zhvf_12m';

// Map geography level to table name
function getTableName(geography: GeographyLevel): string {
  switch (geography) {
    case 'State': return 'zillow_state';
    case 'Metro': return 'zillow_metro';
    case 'County': return 'zillow_county';
    case 'Zip': return 'zillow_zip';
    case 'City': return 'zillow_metro'; // Cities go to metro table
    default: return 'zillow_metro';
  }
}

// Zillow data URLs
export const ZILLOW_ZHVI_URLS: Record<GeographyLevel, string> = {
  State: 'https://files.zillowstatic.com/research/public_csvs/zhvi/State_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
  Metro: 'https://files.zillowstatic.com/research/public_csvs/zhvi/Metro_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
  County: 'https://files.zillowstatic.com/research/public_csvs/zhvi/County_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
  Zip: 'https://files.zillowstatic.com/research/public_csvs/zhvi/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
  City: 'https://files.zillowstatic.com/research/public_csvs/zhvi/City_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv',
};

export class ZillowImporter {
  protected supabase: SupabaseClient;
  protected geography: GeographyLevel;
  protected metricName: MetricName;
  protected batchSize: number;
  protected ingestionLogId: string | null = null;

  constructor(geography: GeographyLevel, metricName: MetricName = 'zhvi', batchSize = 10000) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials in environment');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    this.geography = geography;
    this.metricName = metricName;
    this.batchSize = batchSize;
  }

  async downloadCsv(): Promise<string> {
    const url = ZILLOW_ZHVI_URLS[this.geography];
    console.log(`Downloading ${this.geography} ${this.metricName} data from Zillow...`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    console.log(`Downloaded ${(text.length / 1024 / 1024).toFixed(2)} MB`);
    return text;
  }

  parseCsv(csvText: string): any[] {
    console.log('Parsing CSV...');
    const records = parse(csvText, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
    });
    console.log(`Parsed ${records.length} rows`);
    return records;
  }

  extractDateColumns(record: any): string[] {
    // Date columns are in format YYYY-MM-DD or MM/DD/YYYY
    return Object.keys(record).filter(key => {
      return /^\d{4}-\d{2}-\d{2}$/.test(key) || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(key);
    });
  }

  getRegionId(record: any): number | null {
    // Use Zillow's RegionID as the primary identifier
    const regionId = parseInt(record.RegionID, 10);
    if (isNaN(regionId)) return null;
    return regionId;
  }

  getRegionName(record: any): string {
    if (this.geography === 'State') {
      return record.RegionName || record.StateName || '';
    }
    if (this.geography === 'Metro') {
      return record.RegionName || '';
    }
    if (this.geography === 'County') {
      const county = record.RegionName || '';
      const state = record.StateName || record.State || '';
      return state ? `${county}, ${state}` : county;
    }
    if (this.geography === 'Zip') {
      return record.RegionName || '';
    }
    if (this.geography === 'City') {
      const city = record.RegionName || '';
      const state = record.StateName || record.State || '';
      return state ? `${city}, ${state}` : city;
    }
    return record.RegionName || '';
  }

  getStateCode(record: any): string | null {
    // Extract state code from record
    if (this.geography === 'State') {
      // For states, try to get abbreviation
      return record.StateName?.substring(0, 2) || null;
    }
    // Other geographies may have state info
    return record.State || record.StateName || null;
  }

  getCbsaCode(record: any): string | null {
    // Only metros have CBSA codes
    if (this.geography !== 'Metro') return null;
    // Some Zillow CSV files include CBSACode
    return record.CBSACode || null;
  }

  getFipsCode(record: any): string | null {
    // Build FIPS code for counties
    if (this.geography !== 'County') return null;
    const stateCode = record.StateCodeFIPS;
    const countyCode = record.MunicipalCodeFIPS;
    if (stateCode && countyCode) {
      return String(stateCode).padStart(2, '0') + String(countyCode).padStart(3, '0');
    }
    return null;
  }

  transformRecords(rawRecords: any[]): ZillowRecord[] {
    console.log('Transforming records...');
    const records: ZillowRecord[] = [];

    // Get all date columns for full historical import
    const sampleRecord = rawRecords[0];
    const dateColumns = this.extractDateColumns(sampleRecord);

    console.log(`Processing ${dateColumns.length} date columns (full history)`);

    for (const record of rawRecords) {
      const regionId = this.getRegionId(record);
      const regionName = this.getRegionName(record);

      if (!regionId) continue;

      const stateCode = this.getStateCode(record);
      const cbsaCode = this.getCbsaCode(record);
      const fipsCode = this.getFipsCode(record);

      for (const dateCol of dateColumns) {
        const value = parseFloat(record[dateCol]);
        if (isNaN(value) || value <= 0) continue;

        // Normalize date format to YYYY-MM-DD
        let periodDate = dateCol;
        if (dateCol.includes('/')) {
          const [month, day, year] = dateCol.split('/');
          periodDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }

        const zillowRecord: ZillowRecord = {
          region_id: regionId,
          region_name: regionName,
          state_code: stateCode,
          period_date: periodDate,
          metric_name: this.metricName,
          value,
        };

        // Add geography-specific fields
        if (cbsaCode) zillowRecord.cbsa_code = cbsaCode;
        if (fipsCode) zillowRecord.fips_code = fipsCode;

        records.push(zillowRecord);
      }
    }

    console.log(`Transformed ${records.length} records`);
    return records;
  }

  async getExistingDates(): Promise<Set<string>> {
    const tableName = getTableName(this.geography);
    console.log(`Checking existing data in ${tableName}...`);

    const { data, error } = await this.supabase
      .from(tableName)
      .select('period_date')
      .eq('metric_name', this.metricName)
      .order('period_date', { ascending: false })
      .limit(100);

    if (error) {
      console.warn('Error checking existing dates:', error.message);
      return new Set();
    }

    const dates = new Set(data?.map(d => d.period_date) || []);
    console.log(`Found ${dates.size} existing date(s) for ${this.metricName}`);
    return dates;
  }

  async insertBatch(records: ZillowRecord[]): Promise<{ inserted: number; errors: string[] }> {
    const errors: string[] = [];
    let inserted = 0;

    const tableName = getTableName(this.geography);

    // Build records for upsert based on geography
    const upsertRecords = records.map(r => {
      const base: any = {
        region_id: r.region_id,
        region_name: r.region_name,
        state_code: r.state_code,
        period_date: r.period_date,
        metric_name: r.metric_name,
        value: r.value,
      };

      // Add geography-specific fields
      if (this.geography === 'Metro' && r.cbsa_code) {
        base.cbsa_code = r.cbsa_code;
      }
      if (this.geography === 'County' && r.fips_code) {
        base.fips_code = r.fips_code;
      }

      return base;
    });

    // Use UPSERT with onConflict to handle duplicates
    const { error } = await this.supabase
      .from(tableName)
      .upsert(upsertRecords, {
        onConflict: 'region_id,period_date,metric_name',
        ignoreDuplicates: false,
      });

    if (error) {
      errors.push(`Batch error: ${error.message}`);
    } else {
      inserted = records.length;
    }

    return { inserted, errors };
  }

  async import(forceFullImport = false): Promise<ImportResult> {
    const startTime = Date.now();
    const result: ImportResult = {
      geography: this.geography,
      metricName: this.metricName,
      recordsProcessed: 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      errors: [],
      duration: 0,
    };

    try {
      // Download and parse
      const csvText = await this.downloadCsv();
      if (!csvText) {
        console.log('No data to import');
        result.duration = Date.now() - startTime;
        return result;
      }

      const rawRecords = this.parseCsv(csvText);
      const zillowRecords = this.transformRecords(rawRecords);
      result.recordsProcessed = zillowRecords.length;

      // Filter to only new data unless force full import
      let recordsToInsert = zillowRecords;
      if (!forceFullImport) {
        const existingDates = await this.getExistingDates();
        const latestExisting = [...existingDates].sort().pop();

        if (latestExisting) {
          recordsToInsert = zillowRecords.filter(r => r.period_date > latestExisting);
          console.log(`Filtering to ${recordsToInsert.length} new records (after ${latestExisting})`);
        }
      }

      if (recordsToInsert.length === 0) {
        console.log('No new records to import');
        result.duration = Date.now() - startTime;
        return result;
      }

      // Start ingestion log
      await this.startIngestionLog(recordsToInsert.length);

      // Insert in batches
      const tableName = getTableName(this.geography);
      console.log(`Inserting ${recordsToInsert.length} records into ${tableName} in batches of ${this.batchSize}...`);

      for (let i = 0; i < recordsToInsert.length; i += this.batchSize) {
        const batch = recordsToInsert.slice(i, i + this.batchSize);
        const { inserted, errors } = await this.insertBatch(batch);
        result.recordsInserted += inserted;
        result.errors.push(...errors);

        // Progress update
        const progress = Math.round(((i + batch.length) / recordsToInsert.length) * 100);
        process.stdout.write(`\rProgress: ${progress}% (${i + batch.length}/${recordsToInsert.length})`);

        // Update database progress every 5 batches
        if (Math.floor(i / this.batchSize) % 5 === 0) {
          await this.updateIngestionProgress(recordsToInsert.length, result.recordsInserted, result.errors.length);
        }
      }
      console.log(); // New line after progress

    } catch (error: any) {
      result.errors.push(error.message);
    }

    result.duration = Date.now() - startTime;
    await this.completeIngestionLog(result, startTime);
    return result;
  }

  // Ingestion logging methods
  private async startIngestionLog(totalRecords: number): Promise<void> {
    const tableName = getTableName(this.geography);

    try {
      const { data, error } = await this.supabase
        .from('data_ingestion_log')
        .insert({
          source: 'zillow',
          table_name: tableName,
          metric_name: this.metricName,
          geography_type: this.geography.toLowerCase(),
          status: 'running',
          records_processed: totalRecords,
          records_inserted: 0,
          records_updated: 0,
          records_failed: 0,
          started_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (!error && data) {
        this.ingestionLogId = data.id;
        console.log(`Started ingestion log: ${data.id}`);
      }
    } catch (e: any) {
      console.warn('Could not start ingestion log:', e.message);
    }
  }

  private async updateIngestionProgress(recordsProcessed: number, recordsInserted: number, recordsFailed: number): Promise<void> {
    if (!this.ingestionLogId) return;

    try {
      await this.supabase
        .from('data_ingestion_log')
        .update({
          records_processed: recordsProcessed,
          records_inserted: recordsInserted,
          records_failed: recordsFailed
        })
        .eq('id', this.ingestionLogId);
    } catch (e) {
      // Silently fail - don't interrupt the import
    }
  }

  private async completeIngestionLog(result: ImportResult, startTime: number): Promise<void> {
    if (!this.ingestionLogId) return;

    const durationSeconds = Math.round((Date.now() - startTime) / 1000);
    const status = result.errors.length > 0
      ? (result.recordsInserted > 0 ? 'partial' : 'failed')
      : 'success';

    try {
      await this.supabase
        .from('data_ingestion_log')
        .update({
          status,
          records_processed: result.recordsProcessed,
          records_inserted: result.recordsInserted,
          records_failed: result.errors.length,
          completed_at: new Date().toISOString(),
          duration_seconds: durationSeconds,
          error_message: result.errors.length > 0 ? result.errors.slice(0, 5).join('; ') : null
        })
        .eq('id', this.ingestionLogId);

      const statusIcon = status === 'success' ? 'OK' : status === 'partial' ? 'WARN' : 'ERR';
      console.log(`[${statusIcon}] Ingestion log completed: ${status} (${durationSeconds}s)`);
    } catch (e: any) {
      console.warn('Error completing ingestion log:', e.message);
    }
  }
}

// Backwards compatible alias
export const ZhviImporter = ZillowImporter;

export function printResult(result: ImportResult) {
  console.log('\n=== Import Result ===');
  console.log(`Geography: ${result.geography}`);
  console.log(`Metric: ${result.metricName}`);
  console.log(`Records Processed: ${result.recordsProcessed.toLocaleString()}`);
  console.log(`Records Inserted: ${result.recordsInserted.toLocaleString()}`);
  console.log(`Duration: ${(result.duration / 1000).toFixed(1)}s`);

  if (result.errors.length > 0) {
    console.log(`Errors: ${result.errors.length}`);
    result.errors.slice(0, 5).forEach(e => console.log(`  - ${e}`));
  }
}
