import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

export interface DataQualityReport {
    totalRecords: number;
    validRecords: number;
    invalidRecords: number;
    missingFields: Record<string, number>;
    outliers: number;
    warnings: string[];
}

@Injectable()
export class DataQualityService {
    private readonly logger = new Logger(DataQualityService.name);

    constructor(private readonly supabaseService: SupabaseService) { }

    /**
     * Validate a data point
     */
    validateDataPoint(data: any): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Required fields
        if (!data.geo_code) errors.push('Missing geo_code'); // Note: In backend we often work with region_id, check usage
        if (!data.date) errors.push('Missing date');

        // Date format validation
        if (data.date && !/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
            errors.push(`Invalid date format: ${data.date}`);
        }

        // Numeric field validation
        const numericFields = [
            'home_value',
            'rent_for_apartments',
            'rent_for_houses',
            'days_on_market',
            'total_active_inventory',
            'price_cuts_count'
        ];

        for (const field of numericFields) {
            if (data[field] !== undefined && data[field] !== null) {
                const value = Number(data[field]);
                if (isNaN(value)) {
                    errors.push(`Invalid ${field}: ${data[field]}`);
                } else if (value < 0) {
                    errors.push(`Negative ${field}: ${value}`);
                }
            }
        }

        // Outlier detection (values that are too high)
        if (data.home_value && data.home_value > 10000000) {
            errors.push(`Outlier home_value: ${data.home_value}`);
        }
        if (data.days_on_market && data.days_on_market > 365) {
            errors.push(`Outlier days_on_market: ${data.days_on_market}`);
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Validate a batch of data points
     */
    validateBatch(dataPoints: any[]): DataQualityReport {
        const report: DataQualityReport = {
            totalRecords: dataPoints.length,
            validRecords: 0,
            invalidRecords: 0,
            missingFields: {},
            outliers: 0,
            warnings: []
        };

        for (const point of dataPoints) {
            const validation = this.validateDataPoint(point);

            if (validation.valid) {
                report.validRecords++;
            } else {
                report.invalidRecords++;
                report.warnings.push(
                    `${point.geo_code || point.region_id || 'unknown'}-${point.date || 'unknown'}: ${validation.errors.join(', ')}`
                );
            }

            // Track missing fields
            // Adjusted required fields checking
            const requiredFields = ['date'];
            if (point.home_value !== undefined) requiredFields.push('home_value');

            for (const field of requiredFields) {
                if (!point[field]) {
                    report.missingFields[field] = (report.missingFields[field] || 0) + 1;
                }
            }
        }

        return report;
    }

    /**
     * Log data quality report to database
     */
    async logDataQuality(
        source: string,
        report: DataQualityReport
    ): Promise<void> {
        const supabase = this.supabaseService.getClient();

        const { error } = await supabase
            .from('data_ingestion_logs')
            .insert({
                source_name: source,
                records_processed: report.totalRecords,
                records_failed: report.invalidRecords,
                status: report.invalidRecords === 0 ? 'success' : 'partial',
                metadata: {
                    validRecords: report.validRecords,
                    missingFields: report.missingFields,
                    warnings: report.warnings.slice(0, 10) // Limit warnings
                }
            });

        if (error) {
            this.logger.error(`Failed to log data quality: ${error.message}`);
        }
    }
}
