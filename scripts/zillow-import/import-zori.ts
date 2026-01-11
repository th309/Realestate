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

        // Use specific ZORI table
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
        // Need access to supabase client. 
        // Base class has private 'supabase'. We might need to instantiate our own or cast.
        // Since base class 'supabase' is private, we can't access it easily without ts-ignore or protected.
        // But we passed credentials in constructor, so we can create a new client or use the one we have if we change base to protected.
        // For now, I'll allow the any cast in constructor or just create a new one.
        // Subclassing wrapper:

        const { data, error } = await (this as any).supabase
            .from('zillow_zori')
            .select('date')
            .eq('geography', (this as any).geography)
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
