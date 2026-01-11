#!/usr/bin/env npx tsx
/**
 * Import Zillow ZORI (Rent Index) Data
 *
 * Downloads and imports Zillow Observed Rent Index (ZORI) data.
 * Supports:
 * - All Homes Plus Multifamily (sfrcondomfr)
 * - Single Family (sfr)
 * - Multifamily (mfr)
 *
 * Geographies: Metro (includes US), County, Zip
 *
 * Usage:
 *   npx tsx scripts/zillow-import/import-zori.ts
 */

import { ZhviImporter, printResult, GeographyLevel } from './base-importer';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { join } from 'path';

// Load environment variables
config({ path: join(__dirname, '../../packages/backend/.env') });

const ZORI_BASE_URL = 'https://files.zillowstatic.com/research/public_csvs/zori';

const PROPERTY_TYPE_URLS: Record<string, string> = {
    // Mapping internal type code to Zillow URL segment
    'all': 'uc_sfrcondomfr',
    'sfr': 'uc_sfr', // Predicted
    'mfr': 'uc_mfr', // Predicted
};

const PROPERTY_TYPE_DB_NAMES: Record<string, string> = {
    'all': 'All Homes Plus Multifamily',
    'sfr': 'SFR',
    'mfr': 'Multifamily',
};

class ZoriImporter extends ZhviImporter {
    private propertyTypeCode: string;
    private propertyTypeId: string;

    constructor(geography: GeographyLevel, propertyType: string = 'all') {
        super(geography);
        this.propertyTypeCode = propertyType;
        this.propertyTypeId = PROPERTY_TYPE_URLS[propertyType];
    }

    // Override download URL
    async downloadCsv(): Promise<string> {
        // URL Pattern: {Base}/{Geography}_zori_{Type}_sm_sa_month.csv
        const typeSegment = this.propertyTypeId;
        const url = `${ZORI_BASE_URL}/${this.geography}_zori_${typeSegment}_sm_sa_month.csv`;

        console.log(`Downloading ${this.geography} ZORI (${this.propertyTypeCode})...`);
        console.log(`URL: ${url}`);

        const response = await fetch(url);
        if (!response.ok) {
            if (response.status === 404) {
                console.warn(`Data not found for ${this.geography} - ${this.propertyTypeCode} (404)`);
                return ''; // Handle gracefully
            }
            throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
        }

        const text = await response.text();
        console.log(`Downloaded ${(text.length / 1024 / 1024).toFixed(2)} MB`);
        return text;
    }

    // Override insert table and record structure
    async insertBatch(records: any[]): Promise<{ inserted: number; errors: string[] }> {
        const errors: string[] = [];
        let inserted = 0;

        // 1. Ensure markets exist
        const uniqueMarkets = new Map<string, any>();
        records.forEach(r => {
            if (!uniqueMarkets.has(r.region_id)) {
                let regionType = this.geography.toLowerCase();
                // Map geography to region_type expected by markets table
                if (regionType === 'metro') regionType = 'msa'; // Markets uses 'msa' for metro
                if (regionType === 'zip') regionType = 'zip';
                if (regionType === 'county') regionType = 'county';

                // State extraction
                let stateCode = null;
                if (r.region_name && r.region_name.includes(', ')) {
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

        const marketsToUpsert = Array.from(uniqueMarkets.values());
        if (marketsToUpsert.length > 0) {
            const { error: marketError } = await (this as any).supabase
                .from('markets')
                .upsert(marketsToUpsert, { onConflict: 'region_id' });

            if (marketError) {
                // If this fails, we log it but try to continue (though data insert will likely fail next)
                console.warn('Failed to upsert markets:', marketError.message);
                errors.push(`Market upsert error: ${marketError.message}`);
            }
        }

        // 2. Insert ZORI data
        const { error } = await (this as any).supabase
            .from('zillow_zori')
            .upsert(
                records.map(r => ({
                    region_id: r.region_id,
                    date: r.date,
                    value: r.value,
                    geography: r.geography,
                    property_type: r.property_type,
                    // tier is not used in zori
                })),
                {
                    onConflict: 'region_id,date,property_type',
                    ignoreDuplicates: false,
                }
            );

        if (error) {
            errors.push(`Batch error: ${error.message}`);
        } else {
            inserted = records.length;
        }

        return { inserted, errors };
    }

    // Override transform to set correct property type
    transformRecords(rawRecords: any[]): any[] {
        const dbPropertyType = PROPERTY_TYPE_DB_NAMES[this.propertyTypeCode];

        // Reuse base logic to extract dates and regions
        // We can call super.transformRecords but it sets property_type to 'sfrcondo'
        // So we map the results
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
            .from('zillow_zori')
            .select('date')
            .eq('geography', (this as any).geography)
            .eq('property_type', dbPropertyType)
            .limit(1000);

        if (error) {
            console.warn('Error checking existing dates:', error.message);
            return new Set();
        }

        const dates = new Set(data?.map((d: any) => d.date) || []);
        return dates;
    }
}

async function main() {
    const forceFullImport = process.argv.includes('--force');

    // Geographies to import
    const geographies: GeographyLevel[] = ['Metro', 'County', 'Zip'];

    // Property types to import
    const propertyTypes = ['all', 'sfr', 'mfr'];

    console.log('=== Zillow ZORI Import ===');
    console.log(`Mode: ${forceFullImport ? 'Full Import' : 'Incremental Update'}`);

    for (const geo of geographies) {
        for (const pType of propertyTypes) {
            // Zip MFR might not exist or be huge, we'll try all
            try {
                const importer = new ZoriImporter(geo, pType);
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
