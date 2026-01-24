import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { parse as parseSync } from 'csv-parse/sync';
import { SupabaseService } from '../../supabase/supabase.service';
import { ZILLOW_URLS } from '../config/zillow-urls';
import { ImportResult, TimeSeriesRecord } from '../types';

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

    constructor(private readonly supabaseService: SupabaseService) { }

    async importZillowData(
        metricName: string = 'zhvi',
        limitRows?: number
    ): Promise<ImportResult> {
        const supabase = this.supabaseService.getClient();

        this.logger.log(`Starting Zillow import for: ${metricName}`);

        // Download CSV
        const url = ZILLOW_URLS[metricName];
        if (!url) {
            throw new Error(`Unknown metric: ${metricName}`);
        }

        this.logger.log(`Downloading from: ${url}`);

        try {
            const response = await axios.get(url, {
                timeout: 30000,
                maxContentLength: 50 * 1024 * 1024
            });

            this.logger.log(`Downloaded ${(response.data.length / 1024).toFixed(1)} KB`);

            // Parse CSV
            const records: any[] = parseSync(response.data, {
                columns: true,
                skip_empty_lines: true
            });

            this.logger.log(`Parsed ${records.length} regions`);

            // Limit rows if specified
            const recordsToProcess = limitRows ? records.slice(0, limitRows) : records;
            this.logger.log(`Processing ${recordsToProcess.length} regions`);

            let marketsCreated = 0;
            let timeSeriesInserted = 0;
            let errors = 0;
            const errorDetails: any[] = [];

            for (const [index, record] of recordsToProcess.entries()) {
                try {
                    // Extract metadata columns
                    const regionId = record.RegionID;
                    const regionName = record.RegionName;
                    const regionType = record.RegionType === 'msa' ? 'msa' : record.RegionType;
                    const stateName = record.StateName || null;
                    const sizeRank = record.SizeRank ? parseInt(record.SizeRank) : null;

                    if (!regionId || !regionName) {
                        this.logger.warn(`Skipping row ${index}: missing RegionID or RegionName`);
                        continue;
                    }

                    if ((index + 1) % 10 === 0) {
                        this.logger.debug(`Processing region ${index + 1}/${recordsToProcess.length}: ${regionName}`);
                    }

                    // Step 1: Upsert market record
                    const marketData: MarketRecord = {
                        region_id: regionId,
                        region_name: regionName,
                        region_type: regionType,
                        state_name: stateName || undefined,
                        state_code: stateName ? stateName.substring(0, 2).toUpperCase() : undefined,
                        size_rank: sizeRank || undefined
                    };

                    const { error: marketError } = await supabase
                        .from('markets')
                        .upsert(marketData, {
                            onConflict: 'region_id',
                            ignoreDuplicates: false
                        });

                    if (marketError) {
                        this.logger.error(`Error upserting market ${regionId}: ${marketError.message}`);
                        errors++;
                        continue;
                    }

                    marketsCreated++;

                    // Step 2: Extract and insert time series data
                    const timeSeriesData: TimeSeriesRecord[] = [];

                    // Get all date columns (format: YYYY-MM-DD)
                    // Note: Zillow CSVs often use YYYY-MM-DD format for columns
                    const dateColumns = Object.keys(record).filter(key =>
                        /^\d{4}-\d{2}-\d{2}$/.test(key)
                    );

                    for (const dateCol of dateColumns) {
                        const value = parseFloat(record[dateCol]);

                        // Skip null/empty values
                        if (!isNaN(value) && value !== null && value !== 0) {
                            timeSeriesData.push({
                                region_id: regionId,
                                date: dateCol,
                                metric_name: metricName,
                                metric_value: value,
                                data_source: 'zillow',
                                attributes: {
                                    property_type: 'sfrcondo',
                                    tier: 'middle'
                                }
                            });
                        }
                    }

                    if (timeSeriesData.length > 0) {
                        const batchSize = 100;
                        for (let i = 0; i < timeSeriesData.length; i += batchSize) {
                            const batch = timeSeriesData.slice(i, i + batchSize);

                            try {
                                const { data: tsResult, error: tsError } = await supabase
                                    .from('market_time_series')
                                    .upsert(batch, {
                                        onConflict: 'region_id,date,metric_name,data_source,attributes',
                                        ignoreDuplicates: false
                                    })
                                    .select();

                                if (tsError) {
                                    this.logger.error(`Error upserting time series batch for ${regionId}: ${tsError.message}`);
                                    errorDetails.push({
                                        region: regionId,
                                        error: tsError.message,
                                        code: tsError.code
                                    });
                                    errors++;
                                } else {
                                    timeSeriesInserted += tsResult?.length || batch.length;
                                }
                            } catch (err: any) {
                                this.logger.error(`Exception during upsert for ${regionId}: ${err.message}`);
                                errors++;
                            }
                        }
                    }

                } catch (error: any) {
                    this.logger.error(`Error processing region ${index}: ${error.message}`);
                    errors++;
                }
            }

            this.logger.log(`Import Summary: Markets created: ${marketsCreated}, Time series inserted: ${timeSeriesInserted}, Errors: ${errors}`);

            // Log to data_ingestion_logs (optional but recommended)
            await supabase.from('data_ingestion_logs').insert({
                source: 'zillow',
                dataset: metricName,
                status: errors > 0 ? 'partial' : 'success',
                records_processed: recordsToProcess.length,
                records_inserted: timeSeriesInserted,
                error_message: errors > 0 ? `${errors} errors` : null
            });

            return {
                success: errors === 0,
                message: `Imported ${metricName}: ${marketsCreated} markets, ${timeSeriesInserted} records`,
                details: {
                    marketsCreated,
                    timeSeriesInserted,
                    errors,
                    errorDetails
                }
            };

        } catch (error: any) {
            this.logger.error(`Error downloading or parsing Zillow data: ${error.message}`);
            throw error;
        }
    }

    async testZillowImport() {
        return this.importZillowData('zhvi', 50);
    }
}
