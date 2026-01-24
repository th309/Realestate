
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../packages/backend/.env') });

const DATA_DIR = path.resolve(__dirname, '../../data/raw/redfin_rental');

const dbConfig = {
    host: 'aws-1-us-east-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.pysflbhpnqwoczyuaaif',
    password: 'IHatedoingpt12',
    ssl: { rejectUnauthorized: false }
};

interface RedfinCvsRow {
    'Region': string;
    'Start': string;
    'End': string;
    'Property Type': string;
    'Bedrooms': string;
    'Median Asking Rent': string;
    'Median Asking Rent YoY': string;
}

interface DbRecord {
    period_date: string;
    region_type: 'national' | 'state' | 'metro' | 'county' | 'city' | 'zip';
    region_name: string;
    state_code?: string;
    zip_code?: string;
    median_asking_rent: number | null;
    median_asking_rent_yoy: number | null;
}

function parseNumber(val: string): number | null {
    if (!val || val === '' || val === '-') return null;
    const clean = val.replace(/[$,%]/g, '');
    const num = parseFloat(clean);
    return isNaN(num) ? null : num;
}

function parseDate(monthYear: string): string | null {
    if (!monthYear) return null;
    const date = new Date(monthYear);
    if (isNaN(date.getTime())) return null;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}-01`;
}

async function processFile(filePath: string, client: Client) {
    console.log(`\n📄 Processing file: ${path.basename(filePath)}`);

    // Read as UTF-16LE
    const content = fs.readFileSync(filePath, { encoding: 'utf16le' });
    const cleanContent = content.replace(/^\uFEFF/, ''); // Remove BOM

    const records = parse(cleanContent, {
        columns: true,
        skip_empty_lines: true,
        delimiter: '\t',
        trim: true,
        relax_column_count: true
    });

    console.log(`   📊 Parsed ${records.length} records.`);

    const dbRecords: DbRecord[] = [];

    records.forEach((row: any) => {
        const region = row['Region'] || row['﻿Region'];
        if (!region) return;

        // Filter for 'All' bedrooms
        if (row['Bedrooms'] && row['Bedrooms'] !== 'All') return;

        const period = parseDate(row['End']);
        if (!period) return;

        let regionType: DbRecord['region_type'] = 'city';
        let zipCode = undefined;

        // Region Type Heuristic
        if (region.includes(' Metro')) regionType = 'metro';
        else if (region.length === 2) regionType = 'state';
        else if (['National', 'US', 'USA'].includes(region)) regionType = 'national';
        else if (/^\d{5}$/.test(region)) {
            regionType = 'zip';
            zipCode = region;
        }
        else if (region.includes(' County')) regionType = 'county';

        let stateCode = undefined;
        if (regionType === 'city' || regionType === 'county') {
            const parts = region.split(',');
            if (parts.length > 1) stateCode = parts[1].trim();
        } else if (regionType === 'state') {
            stateCode = region;
        } else if (regionType === 'zip') {
            // Redfin zip rows usually don't have state in region name "90210".
            // We won't have state_code if it's not in the file? 
            // Actually, looking at the city file, columns were Region, ...
            // We might need to rely on the fact that zip is unique enough or we have a map.
            // For now we set state_code null if not found.
        }

        dbRecords.push({
            period_date: period,
            region_type: regionType,
            region_name: region,
            state_code: stateCode,
            zip_code: zipCode,
            median_asking_rent: parseNumber(row['Median Asking Rent']),
            median_asking_rent_yoy: parseNumber(row['Median Asking Rent YoY']),
        });
    });

    console.log(`   ✅ Prepared ${dbRecords.length} records for insertion.`);

    // Insert
    // Group by table
    const batches: Record<string, DbRecord[]> = {};
    for (const rec of dbRecords) {
        const table = `redfin_rental_${rec.region_type}`;
        if (!batches[table]) batches[table] = [];
        batches[table].push(rec);
    }

    for (const [table, rows] of Object.entries(batches)) {
        console.log(`   📥 Inserting ${rows.length} rows into ${table}...`);

        let successes = 0;
        for (const row of rows) {
            let q = '';
            const params: any[] = [row.period_date, row.median_asking_rent, row.median_asking_rent_yoy];

            if (table === 'redfin_rental_national') {
                q = `INSERT INTO redfin_rental_national (period_date, median_asking_rent, median_asking_rent_yoy) 
                        VALUES ($1, $2, $3) ON CONFLICT (period_date) DO UPDATE SET median_asking_rent = EXCLUDED.median_asking_rent, median_asking_rent_yoy = EXCLUDED.median_asking_rent_yoy;`;
            }
            else if (table === 'redfin_rental_state') {
                q = `INSERT INTO redfin_rental_state (period_date, median_asking_rent, median_asking_rent_yoy, state_code, state_name) 
                        VALUES ($1, $2, $3, $4, $4) ON CONFLICT (period_date, state_code) DO UPDATE SET median_asking_rent = EXCLUDED.median_asking_rent, median_asking_rent_yoy = EXCLUDED.median_asking_rent_yoy;`;
                params.push(row.region_name);
            }
            else if (table === 'redfin_rental_metro') {
                // Clean " Metro" suffix for better matching if needed, or keep as is?
                // Consistent with Zillow? Zillow usually has "Atlanta, GA". Redfin might be "Atlanta, GA Metro".
                // Let's strip " Metro" suffix for cleaner match with other datasets if possible.
                const title = row.region_name; // .replace(' Metro', ''); // Optional?
                q = `INSERT INTO redfin_rental_metro (period_date, median_asking_rent, median_asking_rent_yoy, cbsa_title) 
                        VALUES ($1, $2, $3, $4) ON CONFLICT (period_date, cbsa_title) DO UPDATE SET median_asking_rent = EXCLUDED.median_asking_rent, median_asking_rent_yoy = EXCLUDED.median_asking_rent_yoy;`;
                params.push(title);
            }
            else if (table === 'redfin_rental_city') {
                if (!row.state_code) continue;
                const cityName = row.region_name.split(',')[0].trim();
                q = `INSERT INTO redfin_rental_city (period_date, median_asking_rent, median_asking_rent_yoy, city_name, state_code) 
                        VALUES ($1, $2, $3, $4, $5) ON CONFLICT (period_date, city_name, state_code) DO UPDATE SET median_asking_rent = EXCLUDED.median_asking_rent, median_asking_rent_yoy = EXCLUDED.median_asking_rent_yoy;`;
                params.push(cityName);
                params.push(row.state_code);
            }
            else if (table === 'redfin_rental_zip') {
                q = `INSERT INTO redfin_rental_zip (period_date, median_asking_rent, median_asking_rent_yoy, zip_code) 
                        VALUES ($1, $2, $3, $4) ON CONFLICT (period_date, zip_code) DO UPDATE SET median_asking_rent = EXCLUDED.median_asking_rent, median_asking_rent_yoy = EXCLUDED.median_asking_rent_yoy;`;
                params.push(row.region_name);
            }

            if (q) {
                try {
                    await client.query(q, params);
                    successes++;
                } catch (e: any) {
                    // Silent fail
                }
            }
        }
        console.log(`      ✅ Inserted/Updated ${successes} rows.`);
    }
}

async function main() {
    console.log('🚀 Starting Redfin Rental Database Import');

    if (!fs.existsSync(DATA_DIR)) {
        console.error(`❌ Data directory not found: ${DATA_DIR}`);
        return;
    }

    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.csv'));
    if (files.length === 0) {
        console.error('❌ No CSV files found.');
        return;
    }

    console.log(`📂 Found ${files.length} CSV files.`);

    const client = new Client(dbConfig);
    await client.connect();
    console.log('🔌 Connected to database.');

    try {
        for (const file of files) {
            await processFile(path.join(DATA_DIR, file), client);
        }
        console.log('🎉 All files processed.');
    } catch (e) {
        console.error(e);
    } finally {
        await client.end();
    }
}

main().catch(console.error);
