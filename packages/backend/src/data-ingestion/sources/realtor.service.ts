import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { REALTOR_DATASETS, RealtorDatasetConfig } from '../config/realtor.config';
import { parse } from 'csv-parse/sync';
import axios from 'axios';
import { ImportResult } from '../types';
import {
    RealtorNationalRecord,
    RealtorStateRecord,
    RealtorCombinedRecord
} from '../types/realtor.types';
import { normalizeZipKey } from '../../common/zip';

@Injectable()
export class RealtorService {
    private readonly logger = new Logger(RealtorService.name);

    constructor(private readonly supabaseService: SupabaseService) { }

    async importAllRealtorData(limitRows?: number): Promise<ImportResult[]> {
        const results: ImportResult[] = [];
        for (const dataset of REALTOR_DATASETS) {
            results.push(await this.importDataset(dataset.id, limitRows));
        }
        return results;
    }

    async importDataset(datasetId: string, limitRows?: number): Promise<ImportResult> {
        const config = REALTOR_DATASETS.find(d => d.id === datasetId);
        if (!config) {
            throw new Error(`Unknown dataset ID: ${datasetId}`);
        }

        this.logger.log(`Starting import for ${config.description} (${datasetId})`);

        try {
            // Download Core Data
            this.logger.log(`Downloading core data from ${config.downloadUrl}...`);
            const coreCsv = await this.downloadCsv(config.downloadUrl);
            let records: any[] = [];

            // If combined/hotness, we might need to download hotness too
            let hotnessMap = new Map<string, Partial<RealtorCombinedRecord>>();
            if (config.hotnessUrl) {
                this.logger.log(`Downloading hotness data from ${config.hotnessUrl}...`);
                const hotnessCsv = await this.downloadCsv(config.hotnessUrl);
                hotnessMap = this.parseHotnessData(hotnessCsv, config.geography);
            }

            switch (config.geography) {
                case 'national':
                    records = this.parseNationalCSV(coreCsv);
                    break;
                case 'state':
                    records = this.parseStateCSV(coreCsv);
                    break;
                case 'metro':
                    records = this.parseMetroCoreCSV(coreCsv);
                    if (hotnessMap.size > 0) records = this.mergeHotnessData(records, hotnessMap, 'cbsa_code');
                    break;
                case 'county':
                    records = this.parseCountyCoreCSV(coreCsv);
                    if (hotnessMap.size > 0) records = this.mergeHotnessData(records, hotnessMap, 'county_fips');
                    break;
                case 'zip':
                    records = this.parseZipCoreCSV(coreCsv);
                    if (hotnessMap.size > 0) records = this.mergeHotnessData(records, hotnessMap, 'postal_code');
                    break;
                default:
                    throw new Error(`Unsupported geography: ${config.geography}`);
            }

            if (limitRows) {
                records = records.slice(0, limitRows);
            }

            this.logger.log(`Parsed ${records.length} records. Inserting into ${config.tableName}...`);

            return await this.insertRecords(config.tableName, records, config.geography);

        } catch (error: any) {
            this.logger.error(`Error importing ${datasetId}: ${error.message}`);
            return {
                success: false,
                message: `Failed to import ${datasetId}: ${error.message}`,
                errors: [error.message]
            };
        }
    }

    // --- Helpers ---

    private async downloadCsv(url: string): Promise<string> {
        const response = await axios.get(url, {
            timeout: 120000,
            maxContentLength: 500 * 1024 * 1024,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        return response.data;
    }

    private parseYYYYMM(yyyymm: string): Date {
        const year = parseInt(yyyymm.substring(0, 4));
        const month = parseInt(yyyymm.substring(4, 6));
        return new Date(year, month - 1, 1);
    }

    private parseNumeric(value: string | undefined): number | null {
        if (!value || value === '' || value === 'null' || value === 'undefined') return null;
        const num = parseFloat(value);
        return isNaN(num) ? null : num;
    }

    private parseInteger(value: string | undefined): number | null {
        const num = this.parseNumeric(value);
        return num !== null ? Math.round(num) : null;
    }

    // --- Parsing Logic (Ported from Script) ---

    private parseNationalCSV(csvContent: string): RealtorNationalRecord[] {
        const records = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true });
        return records.map((row: any) => this.mapNationalRecord(row));
    }

    private parseStateCSV(csvContent: string): RealtorStateRecord[] {
        const records = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true });
        return records.map((row: any) => this.mapStateRecord(row));
    }

    private parseMetroCoreCSV(csvContent: string): RealtorCombinedRecord[] {
        const records = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true });
        return records.map((row: any) => ({
            ...this.mapCommonFields(row),
            cbsa_code: row.cbsa_code,
            cbsa_title: row.cbsa_title,
            household_rank: this.parseInteger(row.HouseholdRank)
        }));
    }

    private parseCountyCoreCSV(csvContent: string): RealtorCombinedRecord[] {
        const records = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true });
        return records.map((row: any) => ({
            ...this.mapCommonFields(row),
            county_fips: row.county_fips,
            county_name: row.county_name
        }));
    }

    private parseZipCoreCSV(csvContent: string): RealtorCombinedRecord[] {
        const records = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true });
        return records.map((row: any) => ({
            ...this.mapCommonFields(row),
            postal_code: row.postal_code ? normalizeZipKey(String(row.postal_code)) : row.postal_code,
            zip_name: row.zip_name
        }));
    }

    private mapNationalRecord(row: any): RealtorNationalRecord {
        return {
            period_date: this.parseYYYYMM(row.month_date_yyyymm),
            country: row.country || 'United States',
            ...this.mapCommonFields(row) as any // Common fields match mostly
        };
    }

    private mapStateRecord(row: any): RealtorStateRecord {
        return {
            period_date: this.parseYYYYMM(row.month_date_yyyymm),
            state_name: row.state,
            state_id: row.state_id,
            ...this.mapCommonFields(row) as any
        };
    }

    private mapCommonFields(row: any) {
        return {
            period_date: this.parseYYYYMM(row.month_date_yyyymm),
            median_listing_price: this.parseNumeric(row.median_listing_price),
            median_listing_price_mm: this.parseNumeric(row.median_listing_price_mm),
            median_listing_price_yy: this.parseNumeric(row.median_listing_price_yy),
            active_listing_count: this.parseInteger(row.active_listing_count),
            active_listing_count_mm: this.parseNumeric(row.active_listing_count_mm),
            active_listing_count_yy: this.parseNumeric(row.active_listing_count_yy),
            median_days_on_market: this.parseInteger(row.median_days_on_market),
            median_days_on_market_mm: this.parseNumeric(row.median_days_on_market_mm),
            median_days_on_market_yy: this.parseNumeric(row.median_days_on_market_yy),
            new_listing_count: this.parseInteger(row.new_listing_count),
            new_listing_count_mm: this.parseNumeric(row.new_listing_count_mm),
            new_listing_count_yy: this.parseNumeric(row.new_listing_count_yy),
            price_increased_count: this.parseInteger(row.price_increased_count),
            price_increased_count_mm: this.parseNumeric(row.price_increased_count_mm),
            price_increased_count_yy: this.parseNumeric(row.price_increased_count_yy),
            price_increased_share: this.parseNumeric(row.price_increased_share),
            price_increased_share_mm: this.parseNumeric(row.price_increased_share_mm),
            price_increased_share_yy: this.parseNumeric(row.price_increased_share_yy),
            price_reduced_count: this.parseInteger(row.price_reduced_count),
            price_reduced_count_mm: this.parseNumeric(row.price_reduced_count_mm),
            price_reduced_count_yy: this.parseNumeric(row.price_reduced_count_yy),
            price_reduced_share: this.parseNumeric(row.price_reduced_share),
            price_reduced_share_mm: this.parseNumeric(row.price_reduced_share_mm),
            price_reduced_share_yy: this.parseNumeric(row.price_reduced_share_yy),
            pending_listing_count: this.parseInteger(row.pending_listing_count),
            pending_listing_count_mm: this.parseNumeric(row.pending_listing_count_mm),
            pending_listing_count_yy: this.parseNumeric(row.pending_listing_count_yy),
            median_listing_price_per_square_foot: this.parseNumeric(row.median_listing_price_per_square_foot),
            median_listing_price_per_square_foot_mm: this.parseNumeric(row.median_listing_price_per_square_foot_mm),
            median_listing_price_per_square_foot_yy: this.parseNumeric(row.median_listing_price_per_square_foot_yy),
            median_square_feet: this.parseInteger(row.median_square_feet),
            median_square_feet_mm: this.parseNumeric(row.median_square_feet_mm),
            median_square_feet_yy: this.parseNumeric(row.median_square_feet_yy),
            average_listing_price: this.parseNumeric(row.average_listing_price),
            average_listing_price_mm: this.parseNumeric(row.average_listing_price_mm),
            average_listing_price_yy: this.parseNumeric(row.average_listing_price_yy),
            total_listing_count: this.parseInteger(row.total_listing_count),
            total_listing_count_mm: this.parseNumeric(row.total_listing_count_mm),
            total_listing_count_yy: this.parseNumeric(row.total_listing_count_yy),
            pending_ratio: this.parseNumeric(row.pending_ratio),
            pending_ratio_mm: this.parseNumeric(row.pending_ratio_mm),
            pending_ratio_yy: this.parseNumeric(row.pending_ratio_yy),
            quality_flag: this.parseInteger(row.quality_flag) || 0
        };
    }

    private parseHotnessData(csvContent: string, geography: string): Map<string, Partial<RealtorCombinedRecord>> {
        const records = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true });
        const map = new Map<string, Partial<RealtorCombinedRecord>>();

        for (const row of records) {
            let id = '';
            if (geography === 'metro') id = row.cbsa_code;
            else if (geography === 'county') id = row.county_fips;
            else if (geography === 'zip') id = row.postal_code ? normalizeZipKey(String(row.postal_code)) : row.postal_code;

            if (!id) continue;

            const dateStr = row.month_date_yyyymm;
            // NOTE: In the script, key was `${row.month_date_yyyymm}_${id}`
            // But in merge logic, it constructed key from date object. 
            // Here I will use the raw string from CSV if it matches, to avoid conversion issues.
            const key = `${dateStr}_${id}`;

            map.set(key, {
                household_rank: this.parseInteger(row.hh_rank) || this.parseInteger(row.household_rank), // field name varies?
                hotness_rank: this.parseInteger(row.hotness_rank),
                hotness_rank_mm: this.parseNumeric(row.hotness_rank_mm),
                hotness_rank_yy: this.parseNumeric(row.hotness_rank_yy),
                hotness_score: this.parseNumeric(row.hotness_score),
                supply_score: this.parseNumeric(row.supply_score),
                demand_score: this.parseNumeric(row.demand_score),
                median_dom_vs_us: this.parseNumeric(row.median_dom_vs_us),
                median_listing_price_vs_us: this.parseNumeric(row.median_listing_price_vs_us),
                page_view_count_per_property_mm: this.parseNumeric(row.page_view_count_per_property_mm),
                page_view_count_per_property_yy: this.parseNumeric(row.page_view_count_per_property_yy),
                page_view_count_per_property_vs_us: this.parseNumeric(row.page_view_count_per_property_vs_us)
            });
        }
        return map;
    }

    private mergeHotnessData(
        coreRecords: RealtorCombinedRecord[],
        hotnessMap: Map<string, Partial<RealtorCombinedRecord>>,
        idField: keyof RealtorCombinedRecord
    ): RealtorCombinedRecord[] {
        return coreRecords.map(record => {
            const date = record.period_date;
            // Construct YYYYMM string from date
            const year = date.getFullYear();
            const month = date.getMonth() + 1;
            const dateStr = `${year}${month.toString().padStart(2, '0')}`;

            const id = record[idField] as string;
            const key = `${dateStr}_${id}`;

            const hotness = hotnessMap.get(key);
            return hotness ? { ...record, ...hotness } : record;
        });
    }

    private async insertRecords(tableName: string, records: any[], geography: string): Promise<ImportResult> {
        const supabase = this.supabaseService.getClient();
        let inserted = 0;
        let errors = 0;
        const batchSize = 1000;

        // Determine conflict key
        let onConflict = 'period_date';
        if (geography === 'state') onConflict += ',state_id';
        else if (geography === 'metro') onConflict += ',cbsa_code';
        else if (geography === 'county') onConflict += ',county_fips';
        else if (geography === 'zip') onConflict += ',postal_code';

        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize);

            // Format Date objects to strings for Supabase
            const formattedBatch = batch.map(r => ({
                ...r,
                period_date: r.period_date.toISOString().split('T')[0]
            }));

            const { data, error } = await supabase
                .from(tableName)
                .upsert(formattedBatch, { onConflict: onConflict, ignoreDuplicates: false })
                .select();

            if (error) {
                this.logger.error(`Batch insert error for ${tableName}: ${error.message}`);
                errors += batch.length;
            } else {
                inserted += data?.length || 0;
            }
        }

        return {
            success: errors === 0,
            message: `Imported ${tableName}: ${inserted} records`,
            recordsInserted: inserted,
            errors: errors > 0 ? [{ message: `${errors} records failed to insert` }] : []
        };
    }
}
