#!/usr/bin/env npx tsx
/**
 * Import Zillow ZORDI (Renter Demand Index) Data
 *
 * Downloads and imports Zillow Observed Renter Demand Index (ZORDI) data.
 * Supports:
 * - All Homes Plus Multifamily (sfrcondomfr)
 * - Single Family (sfr)
 * - Multifamily (mfr)
 *
 * Geographies: Metro (includes US), County, Zip
 *
 * Usage:
 *   npx tsx scripts/zillow-import/import-zordi.ts
 */

import { ZhviImporter, ImportResult, printResult, GeographyLevel } from './base-importer';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(__dirname, '../../packages/backend/.env') });

const ZORDI_BASE_URL = 'https://files.zillowstatic.com/research/public_csvs/zordi';

const PROPERTY_TYPE_URLS: Record<string, string> = {
    // Mapping internal type code to Zillow URL segment
    'all': 'uc_sfrcondomfr',
    'sfr': 'uc_sfr',
    'mfr': 'uc_mfr',
};

const PROPERTY_TYPE_DB_NAMES: Record<string, string> = {
    'all': 'All Homes Plus Multifamily',
    'sfr': 'SFR',
    'mfr': 'Multifamily',
};

class ZordiImporter extends ZhviImporter {
    private propertyTypeCode: string;
    private propertyTypeId: string;

    constructor(geography: GeographyLevel, propertyType: string = 'all') {
        super(geography);
        this.propertyTypeCode = propertyType;
        this.propertyTypeId = PROPERTY_TYPE_URLS[propertyType];
    }

    // Override download URL
    protected getDownloadUrl(): string {
        // Pattern: {Geography}_zordi_{PropertyType}_month.csv
        const geoPrefix = (this as any).geography;
        return `${ZORDI_BASE_URL}/${geoPrefix}_zordi_${this.propertyTypeId}_month.csv`;
    }

    // Override table name
    protected getTableName(): string {
        return 'zillow_zordi';
    }

    // Override transformation to handle specific property type mapping if needed
    protected transformRecords(rawRecords: any[]): any[] {
        const dbPropertyType = PROPERTY_TYPE_DB_NAMES[this.propertyTypeCode];

        // ZORDI CSV structure is similar to ZHVI/ZORI (RegionID, SizeRank, RegionName, RegionType, StateName, Date Columns...)
        // Use base transformer but inject property type
        const records = super.transformRecords(rawRecords);

        return records.map(r => ({
            ...r,
            property_type: dbPropertyType,
            tier: undefined // Remove tier
        }));
    }

    // Override existing check to target correct table
    async getExistingDates(): Promise<Set<string>> {
        const dbPropertyType = PROPERTY_TYPE_DB_NAMES[this.propertyTypeCode];

        const { data, error } = await (this as any).supabase
            .from('zillow_zordi')
            .select('date')
            .eq('geography', (this as any).geography)
            .eq('property_type', dbPropertyType)
            .limit(1000);

        if (error) {
            console.warn('Error checking existing dates:', error.message);
            // If table doesn't exist, this fails. We assume migration is run.
            return new Set();
        }

        const dates = new Set(data?.map((d: any) => d.date) || []);
        return dates;
    }

    // Override batch insert to target zillow_zordi and ensure markets exist
    protected async insertBatch(records: any[]): Promise<void> {
        if (records.length === 0) return;

        // 1. Upsert Markets to ensure FK integrity
        const uniqueMarkets = new Map<string, any>();
        records.forEach(r => {
            // Check if region_name exists (it should from base transform)
            if (r.region_id && r.region_name && !uniqueMarkets.has(r.region_id)) {
                let regionType = this.geography.toLowerCase();
                // Map geography to region_type expected by markets table
                if (regionType === 'metro') regionType = 'msa';
                if (regionType === 'zip') regionType = 'zip';
                if (regionType === 'county') regionType = 'county';

                let stateCode = null;
                if (r.region_name.includes(', ')) {
                    stateCode = r.region_name.split(', ')[1];
                }

                uniqueMarkets.set(r.region_id, {
                    region_id: r.region_id,
                    region_name: r.region_name,
                    region_type: regionType,
                    state_code: stateCode
                });
            }
        });

        if (uniqueMarkets.size > 0) {
            const { error: marketError } = await (this as any).supabase
                .from('markets')
                .upsert(Array.from(uniqueMarkets.values()), { onConflict: 'region_id' });

            if (marketError) {
                console.warn('Failed to upsert markets:', marketError.message);
            }
        }

        // 2. Insert ZORDI data
        // We map records to ensure only valid columns are sent and geography is correct
        const rowsToInsert = records.map(r => ({
            region_id: r.region_id,
            date: r.date,
            value: r.value,
            // Ensure geography is set from the class property if not in record
            geography: this.geography,
            property_type: r.property_type
        }));

        const { error } = await (this as any).supabase
            .from(this.getTableName())
            .upsert(rowsToInsert, {
                onConflict: 'region_id,date,property_type',
                ignoreDuplicates: false
            });

        if (error) {
            throw error;
        }
    }
}

async function main() {
    const forceFullImport = process.argv.includes('--force');

    // Geographies to import
    const geographies: GeographyLevel[] = ['Metro', 'County', 'Zip'];

    // Property types to import
    const propertyTypes = ['all', 'sfr', 'mfr'];

    console.log('=== Zillow ZORDI Import ===');
    console.log(`Mode: ${forceFullImport ? 'Full Import' : 'Incremental Update'}`);

    for (const geo of geographies) {
        for (const pType of propertyTypes) {
            try {
                const importer = new ZordiImporter(geo, pType);
                const result = await importer.import(forceFullImport);
                if (result.recordsProcessed > 0) {
                    printResult(result);
                }
            } catch (e) {
                console.error(`Failed to import ${geo} - ${pType}:`, e);
            }
        }
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
