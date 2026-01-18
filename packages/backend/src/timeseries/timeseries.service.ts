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
 *
 * @version 2.0.0 - Fixed column name mappings for all data sources
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
            // Census tables use 'year' field, others use 'period_date'
            const dateField = mapping.source === 'census' ? 'year' : 'period_date';

            // Build and execute query
            let query = this.supabase
                .from(table)
                .select(`${dateField}, ${mapping.columnName}`)
                .order(dateField, { ascending: true });

            // Add region filter
            query = this.addRegionFilter(query, geoLevel, regionId, mapping.source);

            // For Zillow tables, add metric_name filter
            if (mapping.usesMetricName) {
                query = query.eq('metric_name', mapping.metricNameValue);
            }

            // Add date/year filters
            if (startDate) {
                if (mapping.source === 'census') {
                    // Extract year from date string (YYYY-MM-DD -> YYYY)
                    const year = parseInt(startDate.split('-')[0]);
                    query = query.gte(dateField, year);
                } else {
                    query = query.gte(dateField, startDate);
                }
            }
            if (endDate) {
                if (mapping.source === 'census') {
                    const year = parseInt(endDate.split('-')[0]);
                    query = query.lte(dateField, year);
                } else {
                    query = query.lte(dateField, endDate);
                }
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
                // Convert year to date string: 2023 -> "2023-01-01"
                date: mapping.source === 'census' ? `${row[dateField]}-01-01` : row[dateField],
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
     *
     * Column names vary by data source:
     * - Realtor: state_name, county_fips, postal_code, country
     * - Zillow: region_name (for state/city/zip), cbsa_code, fips_code
     * - Census: state_name, cbsa_code, fips_code, zcta, place_name
     * - Economic: state_name, cbsa_code, fips_code
     */
    private addRegionFilter(query: any, geoLevel: string, regionId: string, source: string) {
        const level = geoLevel.toLowerCase();

        switch (level) {
            case 'national':
                // Realtor national uses 'country' column
                // Census/Economic national tables have only one row per period, no region filter needed
                if (source === 'realtor') {
                    return query.eq('country', 'United States');
                }
                // Census and Economic national tables don't need a region filter
                // They have only one row per period_date/year
                return query;

            case 'state':
                // Realtor: state_name (full name) or state_id (2-letter abbrev)
                // Zillow: region_name (full name)
                // Census/Economic: state_name (full name) or state_fips
                if (source === 'realtor') {
                    if (regionId.length === 2) {
                        return query.eq('state_id', regionId.toUpperCase());
                    }
                    return query.eq('state_name', regionId);
                } else if (source === 'zillow') {
                    return query.eq('region_name', regionId);
                } else {
                    // Census and Economic use state_name
                    return query.eq('state_name', regionId);
                }

            case 'metro':
                // All sources use cbsa_code for metros
                return query.eq('cbsa_code', regionId);

            case 'county':
                // Realtor: county_fips
                // Zillow: fips_code
                // Census/Economic: fips_code
                if (source === 'realtor') {
                    return query.eq('county_fips', regionId);
                }
                return query.eq('fips_code', regionId);

            case 'zip':
                // Realtor: postal_code
                // Zillow: region_name (ZIP code as string)
                // Census: zcta
                if (source === 'realtor') {
                    return query.eq('postal_code', regionId);
                } else if (source === 'zillow') {
                    return query.eq('region_name', regionId);
                } else if (source === 'census') {
                    return query.eq('zcta', regionId);
                }
                return query.eq('postal_code', regionId);

            case 'city':
                // Zillow: region_name
                // Census: place_name
                if (source === 'census') {
                    return query.eq('place_name', regionId);
                }
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

        if (source === 'census') {
            if (level === 'national') return 'census_national';
            if (level === 'state') return 'census_state';
            if (level === 'metro') return 'census_metro';
            if (level === 'county') return 'census_county';
            if (level === 'city') return 'census_city';
            if (level === 'zip') return 'census_zip';
        }

        if (source === 'economic') {
            if (level === 'national') return 'economic_national';
            if (level === 'state') return 'economic_state';
            if (level === 'metro') return 'economic_metro';
            if (level === 'county') return 'economic_county';
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

            // ========================================================================
            // CENSUS/DEMOGRAPHIC METRICS (Direct Column Names, uses 'year' not 'period_date')
            // ========================================================================
            'population': {
                source: 'census',
                columnName: 'total_population',
                usesMetricName: false,
            },
            'population_growth': {
                source: 'census',
                columnName: 'population_yoy',
                usesMetricName: false,
            },
            'median_income': {
                source: 'census',
                columnName: 'median_household_income',
                usesMetricName: false,
            },
            'income_growth': {
                source: 'census',
                columnName: 'income_yoy',
                usesMetricName: false,
            },
            'median_age': {
                source: 'census',
                columnName: 'median_age',
                usesMetricName: false,
            },
            'homeownership_rate': {
                source: 'census',
                columnName: 'homeownership_rate',
                usesMetricName: false,
            },

            // ========================================================================
            // ECONOMIC METRICS (Direct Column Names)
            // ========================================================================
            'unemployment_rate': {
                source: 'economic',
                columnName: 'unemployment_rate',
                usesMetricName: false,
            },
            'job_growth': {
                source: 'economic',
                columnName: 'employment_yoy',
                usesMetricName: false,
            },
            'gdp_growth': {
                source: 'economic',
                columnName: 'gdp_yoy',
                usesMetricName: false,
            },
            'cost_of_living': {
                source: 'economic',
                columnName: 'rpp_all_items',
                usesMetricName: false,
            },
        };

        return mappings[metricId] || null;
    }
}
