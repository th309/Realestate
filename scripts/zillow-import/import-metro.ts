#!/usr/bin/env npx tsx
/**
 * Import Zillow ZHVI Metro-level data
 *
 * Downloads and imports metro/MSA-level home value index data into zillow_metro table.
 * Uses CBSA crosswalk from database for map display compatibility.
 * Run monthly to keep data current.
 *
 * Usage:
 *   npx tsx scripts/zillow-import/import-metro.ts
 *   npx tsx scripts/zillow-import/import-metro.ts --force  # Full reimport
 */

import { ZillowImporter, printResult, ZillowRecord } from './base-importer';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

config({ path: join(__dirname, '../../packages/backend/.env') });

// CBSA crosswalk mapping: Zillow RegionID -> CBSA info
interface CbsaCrosswalkEntry {
  cbsaCode: string;
  cbsaName: string;
  cbsaType: string;
}

class MetroImporterWithCbsa extends ZillowImporter {
  private cbsaCrosswalk: Map<number, CbsaCrosswalkEntry> = new Map();

  constructor(batchSize = 10000) {
    super('Metro', 'zhvi', batchSize);
  }

  async loadCbsaCrosswalk(): Promise<void> {
    console.log('Loading CBSA crosswalk from database...');

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data, error } = await supabase
      .from('zillow_metro_crosswalk')
      .select('zillow_region_id, cbsa_code, cbsa_title, cbsa_type');

    if (error) {
      console.error('Error loading CBSA crosswalk:', error.message);
      return;
    }

    for (const record of data || []) {
      this.cbsaCrosswalk.set(record.zillow_region_id, {
        cbsaCode: record.cbsa_code,
        cbsaName: record.cbsa_title || '',
        cbsaType: record.cbsa_type || '',
      });
    }

    console.log(`Loaded ${this.cbsaCrosswalk.size} CBSA mappings from database`);
  }

  // Override getCbsaCode to use the crosswalk
  getCbsaCode(record: any): string | null {
    const regionId = parseInt(record.RegionID, 10);
    if (isNaN(regionId)) return null;

    const crosswalkEntry = this.cbsaCrosswalk.get(regionId);
    if (crosswalkEntry) {
      return crosswalkEntry.cbsaCode;
    }

    // Fallback to CSV field if present
    return record.CBSACode || null;
  }

  // Override transformRecords to ensure CBSA codes are added
  transformRecords(rawRecords: any[]): ZillowRecord[] {
    console.log('Transforming records with CBSA lookup...');
    const records: ZillowRecord[] = [];

    const sampleRecord = rawRecords[0];
    const dateColumns = this.extractDateColumns(sampleRecord);

    console.log(`Processing ${dateColumns.length} date columns (full history)`);

    let withCbsa = 0;
    let withoutCbsa = 0;

    for (const record of rawRecords) {
      const regionId = this.getRegionId(record);
      const regionName = this.getRegionName(record);

      if (!regionId) continue;

      const stateCode = this.getStateCode(record);
      const cbsaCode = this.getCbsaCode(record);

      if (cbsaCode) {
        withCbsa++;
      } else {
        withoutCbsa++;
      }

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

        // Add CBSA code if available
        if (cbsaCode) {
          zillowRecord.cbsa_code = cbsaCode;
        }

        records.push(zillowRecord);
      }
    }

    console.log(`Transformed ${records.length} records`);
    console.log(`  Metros with CBSA code: ${withCbsa}`);
    console.log(`  Metros without CBSA code: ${withoutCbsa}`);
    return records;
  }
}

async function main() {
  const forceFullImport = process.argv.includes('--force');

  console.log('=== Zillow ZHVI Metro Import (with CBSA lookup) ===');
  console.log(`Target: zillow_metro table`);
  console.log(`Mode: ${forceFullImport ? 'Full Import' : 'Incremental Update'}`);
  console.log(`Batch size: 10000`);
  console.log(`Date: ${new Date().toISOString()}\n`);

  const importer = new MetroImporterWithCbsa(10000);
  await importer.loadCbsaCrosswalk();
  const result = await importer.import(forceFullImport);

  printResult(result);

  process.exit(result.errors.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
