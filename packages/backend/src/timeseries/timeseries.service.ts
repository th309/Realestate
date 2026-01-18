import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';

export interface TimeSeriesDataPoint {
    date: string;
    value: number;
}

export interface DateRange {
    minDate: string;
    maxDate: string;
    count: number;
}

/**
 * TimeSeriesService
 * 
 * Provides unified historical time-series data access across all metrics and geographies.
 * This service replicates the exact query patterns used by the map page, but returns
 * ALL historical data instead of just the latest value.
 * 
 * Key Differences in Table Structures:
 * - Realtor tables: Each metric is a dedicated column (e.g., median_listing_price)
 * - Zillow tables: Use metric_name column + value column
 */
@Injectable()
export class TimeSeriesService {
    constructor(
        @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    ) { }

    /**
     * Get time series data for a specific metric/geography/region
     */
    async getTimeSeries(
        metricId: string,
        geoLevel: string,
        regionId: string,
        startDate?: string,
        endDate?: string,
        limit?: number,
    ): Promise<TimeSeriesDataPoint[]> {
        const mapping = this.getMetricMapping(metricId);
        if (!mapping) {
            console.warn(`Metric ${metricId} not yet mapped in TimeSeriesService`);
            return [];
        }

        const table = this.getTableName(mapping.source, geoLevel);
        if (!table) {
            console.warn(`No table found for ${mapping.source} at ${geoLevel} level`);
            return [];
        }

        try {
            // Build and execute query
            let query = this.supabase
                .from(table)
                .select(`period_date, ${mapping.columnName}`)
                .order('period_date', { ascending: true });

            // Add region filter
            query = this.addRegionFilter(query, geoLevel, regionId, mapping.source);

            // For Zillow tables, add metric_name filter
            if (mapping.usesMetricName) {
                query = query.eq('metric_name', mapping.metricNameValue);
            }

            // Add date filters
            if (startDate) {
                query = query.gte('period_date', startDate);
            }
            if (endDate) {
                query = query.lte('period_date', endDate);
            }

            // Add limit
            if (limit) {
                query = query.limit(limit);
            }

            const { data, error } = await query;

            if (error) {
                throw new Error(`Error fetching time series for ${metricId}: ${error.message}`);
            }

            if (!data || data.length === 0) return [];

            // Transform to standard format
            return data.map(row => ({
                date: row.period_date,
                value: Number(row[mapping.columnName]) || 0,
            }));
        } catch (err) {
            console.error(`TimeSeriesService error for ${metricId}:`, err);
            return [];
        }
    }

    /**
     * Get available date range for a metric/geography
     */
    async getAvailableDates(metricId: string, geoLevel: string): Promise<DateRange> {
        const mapping = this.getMetricMapping(metricId);
        if (!mapping) {
            return { minDate: '', maxDate: '', count: 0 };
        }

        const table = this.getTableName(mapping.source, geoLevel);
        if (!table) {
            return { minDate: '', maxDate: '', count: 0 };
        }

        try {
            let query = this.supabase
                .from(table)
                .select('period_date')
                .order('period_date', { ascending: true });

            // For Zillow tables, filter by metric_name
            if (mapping.usesMetricName) {
                query = query.eq('metric_name', mapping.metricNameValue);
            }

            const { data, error } = await query;

            if (error || !data || data.length === 0) {
                return { minDate: '', maxDate: '', count: 0 };
            }

            const dates = data.map(d => d.period_date);
            const uniqueDates = [...new Set(dates)];

            return {
                minDate: uniqueDates[0],
                maxDate: uniqueDates[uniqueDates.length - 1],
                count: uniqueDates.length,
            };
        } catch (err) {
            console.error(`Error getting date range for ${metricId}:`, err);
            return { minDate: '', maxDate: '', count: 0 };
        }
    }

    /**
     * Add region-specific filter based on geography level and data source
     */
    private addRegionFilter(query: any, geoLevel: string, regionId: string, source: string) {
        const level = geoLevel.toLowerCase();

        switch (level) {
            case 'national':
                return query.eq('region_name', 'United States');

            case 'state':
                // Realtor uses state_id (abbreviation like 'FL')
                // Zillow uses region_name (full name like 'Florida')
                if (source === 'realtor') {
                    // If regionId is a full name, it will work with region_name
                    // If it's an abbreviation, use state_id
                    if (regionId.length === 2) {
                        return query.eq('state_id', regionId.toUpperCase());
                    }
                    return query.eq('region_name', regionId);
                } else {
                    // Zillow uses full state name
                    return query.eq('region_name', regionId);
                }

            case 'metro':
                return query.eq('cbsa_code', regionId);

            case 'county':
                return query.eq('county_fips', regionId);

            case 'zip':
                return query.eq('postal_code', regionId);

            case 'city':
                return query.eq('region_name', regionId);

            default:
                return query.eq('region_id', regionId);
        }
    }

    /**
     * Get table name based on data source and geography level
     */
    private getTableName(source: string, geoLevel: string): string | null {
        const level = geoLevel.toLowerCase();

        if (source === 'zillow') {
            if (level === 'metro') return 'zillow_metro';
            if (level === 'state') return 'zillow_state';
            if (level === 'county') return 'zillow_county';
            if (level === 'zip') return 'zillow_zip';
            if (level === 'city') return 'zillow_city';
        }

        if (source === 'realtor') {
            if (level === 'national') return 'realtor_national';
            if (level === 'metro') return 'realtor_metro';
            if (level === 'state') return 'realtor_state';
            if (level === 'county') return 'realtor_county';
            if (level === 'zip') return 'realtor_zip';
        }

        return null;
    }

    /**
     * Map frontend metric ID to database table source and column name.
     * 
     * This mapping EXACTLY matches what the map page uses:
     * - Realtor tables: Direct column names (e.g., median_listing_price)
     * - Zillow tables: metric_name filter + value column
     */
    private getMetricMapping(metricId: string): {
        source: string;
        columnName: string;
        usesMetricName: boolean;
        metricNameValue?: string;
    } | null {
        const mappings: Record<string, {
            source: string;
            columnName: string;
            usesMetricName: boolean;
            metricNameValue?: string;
        }> = {
            // ========================================================================
            // REALTOR METRICS (Direct Column Names)
            // ========================================================================
            'listing_price': {
                source: 'realtor',
                columnName: 'median_listing_price',
                usesMetricName: false,
            },
            'home_value_yoy': {
                source: 'realtor',
                columnName: 'median_listing_price_yy',
                usesMetricName: false,
            },
            'home_value_mom': {
                source: 'realtor',
                columnName: 'median_listing_price_mm',
                usesMetricName: false,
            },
            'for_sale_inventory': {
                source: 'realtor',
                columnName: 'active_listing_count',
                usesMetricName: false,
            },
            'inventory_yoy': {
                source: 'realtor',
                columnName: 'active_listing_count_yy',
                usesMetricName: false,
            },
            'days_on_market': {
                source: 'realtor',
                columnName: 'median_days_on_market',
                usesMetricName: false,
            },
            'new_listings': {
                source: 'realtor',
                columnName: 'new_listing_count',
                usesMetricName: false,
            },
            'pending_listings': {
                source: 'realtor',
                columnName: 'pending_listing_count',
                usesMetricName: false,
            },
            'price_cut_pct': {
                source: 'realtor',
                columnName: 'price_reduced_share',
                usesMetricName: false,
            },
            'price_per_sqft': {
                source: 'realtor',
                columnName: 'median_listing_price_per_square_foot',
                usesMetricName: false,
            },
            'pending_ratio': {
                source: 'realtor',
                columnName: 'pending_ratio',
                usesMetricName: false,
            },
            'hotness_score': {
                source: 'realtor',
                columnName: 'hotness_score',
                usesMetricName: false,
            },
            'supply_score': {
                source: 'realtor',
                columnName: 'supply_score',
                usesMetricName: false,
            },
            'demand_score': {
                source: 'realtor',
                columnName: 'demand_score',
                usesMetricName: false,
            },
            'price_increase_pct': {
                source: 'realtor',
                columnName: 'price_increased_share',
                usesMetricName: false,
            },
            'new_listings_yoy': {
                source: 'realtor',
                columnName: 'new_listing_count_yy',
                usesMetricName: false,
            },

            // ========================================================================
            // ZILLOW METRICS (Uses metric_name + value column)
            // ========================================================================
            'home_value': {
                source: 'zillow',
                columnName: 'value',
                usesMetricName: true,
                metricNameValue: 'zhvi',
            },
            'home_price_forecast': {
                source: 'zillow',
                columnName: 'value',
                usesMetricName: true,
                metricNameValue: 'zhvf_12m',
            },
            'rent_index': {
                source: 'zillow',
                columnName: 'value',
                usesMetricName: true,
                metricNameValue: 'zori',
            },
            'rent_for_houses': {
                source: 'zillow',
                columnName: 'value',
                usesMetricName: true,
                metricNameValue: 'zordi_sfr',
            },
            'sale_price': {
                source: 'zillow',
                columnName: 'value',
                usesMetricName: true,
                metricNameValue: 'sale_price',
            },
            'sale_to_list': {
                source: 'zillow',
                columnName: 'value',
                usesMetricName: true,
                metricNameValue: 'sale_to_list',
            },
            'home_sales': {
                source: 'zillow',
                columnName: 'value',
                usesMetricName: true,
                metricNameValue: 'sales_count',
            },
            'market_heat': {
                source: 'zillow',
                columnName: 'value',
                usesMetricName: true,
                metricNameValue: 'market_heat_index',
            },
            'new_construction_sales': {
                source: 'zillow',
                columnName: 'value',
                usesMetricName: true,
                metricNameValue: 'new_con_sales',
            },
            'new_construction_price': {
                source: 'zillow',
                columnName: 'value',
                usesMetricName: true,
                metricNameValue: 'new_con_median_price',
            },
            'new_construction_ppsf': {
                source: 'zillow',
                columnName: 'value',
                usesMetricName: true,
                metricNameValue: 'new_con_median_price_per_sqft',
            },
        };

        return mappings[metricId] || null;
    }
}
