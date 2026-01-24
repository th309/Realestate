import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { SupabaseService } from '../../supabase/supabase.service';
import { TimeSeriesRecord } from '../types';

const FRED_API_BASE = 'https://api.stlouisfed.org/fred/series/observations';
const UNITED_STATES_REGION_ID = '102001';

interface FREDResponse {
    observations: {
        date: string;
        value: string;
    }[];
    realtime_start: string;
    realtime_end: string;
}

const FRED_SERIES = {
    mortgage_rate_30yr: {
        series_id: 'MORTGAGE30US',
        metric_name: 'mortgage_rate_30yr',
        description: '30-Year Fixed Rate Mortgage Average'
    },
    mortgage_rate_15yr: {
        series_id: 'MORTGAGE15US',
        metric_name: 'mortgage_rate_15yr',
        description: '15-Year Fixed Rate Mortgage Average'
    },
    unemployment_rate: {
        series_id: 'UNRATE',
        metric_name: 'unemployment_rate',
        description: 'Unemployment Rate'
    }
};

@Injectable()
export class FredService {
    private readonly logger = new Logger(FredService.name);

    constructor(private readonly supabaseService: SupabaseService) { }

    async importFREDData(
        seriesKeys: string[] = ['mortgage_rate_30yr'],
        apiKey?: string
    ): Promise<any> {
        const supabase = this.supabaseService.getClient();
        const fredApiKey = apiKey || process.env.FRED_API_KEY;

        if (!fredApiKey) {
            throw new Error('FRED API key is required. Set FRED_API_KEY environment variable or pass as parameter.');
        }

        this.logger.log(`Starting FRED import for: ${seriesKeys.join(', ')}`);

        // Ensure United States region exists
        const { error: marketError } = await supabase
            .from('markets')
            .upsert({
                region_id: UNITED_STATES_REGION_ID,
                region_name: 'United States',
                region_type: 'country'
            }, {
                onConflict: 'region_id',
                ignoreDuplicates: false
            });

        if (marketError) {
            this.logger.warn(`Could not ensure United States region exists: ${marketError.message}`);
        } else {
            this.logger.log('United States region verified');
        }

        let totalRecordsInserted = 0;
        const errors: any[] = [];

        for (const seriesKey of seriesKeys) {
            const series = FRED_SERIES[seriesKey as keyof typeof FRED_SERIES];

            if (!series) {
                this.logger.warn(`Unknown series: ${seriesKey}`);
                continue;
            }

            try {
                this.logger.log(`Fetching ${series.description} (${series.series_id})...`);

                const url = `${FRED_API_BASE}?series_id=${series.series_id}&api_key=${fredApiKey}&file_type=json&observation_start=2000-01-01`;

                const response = await axios.get<FREDResponse>(url, {
                    timeout: 30000
                });

                const observations = response.data.observations || [];
                this.logger.log(`Fetched ${observations.length} observations`);

                const timeSeriesData: TimeSeriesRecord[] = [];

                for (const obs of observations) {
                    const value = parseFloat(obs.value);

                    if (!isNaN(value) && obs.value !== '.') {
                        timeSeriesData.push({
                            region_id: UNITED_STATES_REGION_ID,
                            date: obs.date,
                            metric_name: series.metric_name,
                            metric_value: value,
                            data_source: 'fred',
                            attributes: {
                                series_id: series.series_id
                            }
                        });
                    }
                }

                this.logger.log(`Prepared ${timeSeriesData.length} records for insertion`);

                if (timeSeriesData.length > 0) {
                    const batchSize = 100;
                    let inserted = 0;

                    for (let i = 0; i < timeSeriesData.length; i += batchSize) {
                        const batch = timeSeriesData.slice(i, i + batchSize);

                        try {
                            const { error } = await supabase
                                .from('market_time_series')
                                .upsert(batch, {
                                    onConflict: 'region_id,date,metric_name,data_source,attributes',
                                    ignoreDuplicates: false
                                });

                            if (error) {
                                this.logger.error(`Error upserting batch: ${error.message}`);
                                errors.push({
                                    series: seriesKey,
                                    error: error.message,
                                    code: error.code
                                });
                            } else {
                                inserted += batch.length;
                            }
                        } catch (err: any) {
                            this.logger.error(`Exception during upsert: ${err.message}`);
                            errors.push({
                                series: seriesKey,
                                error: err.message
                            });
                        }
                    }

                    totalRecordsInserted += inserted;
                    this.logger.log(`Successfully imported ${inserted} records for ${series.description}`);
                }

                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (error: any) {
                this.logger.error(`Error fetching ${series.description}: ${error.message}`);
                errors.push({
                    series: seriesKey,
                    error: error.message
                });
            }
        }

        this.logger.log(`FRED Import Summary: Total records inserted: ${totalRecordsInserted}`);
        if (errors.length > 0) {
            this.logger.error(`Errors: ${errors.length}`);
        }

        return {
            success: errors.length === 0,
            recordsInserted: totalRecordsInserted,
            errors,
            message: `Imported FRED data: ${totalRecordsInserted} records`
        };
    }
}
