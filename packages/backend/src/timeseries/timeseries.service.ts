import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

interface TimeSeriesDataPoint {
    date: string;
    value: number;
}

interface DateRange {
    minDate: string;
    maxDate: string;
    count: number;
}

@Injectable()
export class TimeSeriesService {
    constructor(
        @InjectRepository(ZillowMetro)
        private zillowMetroRepo: Repository<any>,
        @InjectRepository(ZillowState)
        private zillowStateRepo: Repository<any>,
        @InjectRepository(ZillowCounty)
        private zillowCountyRepo: Repository<any>,
        @InjectRepository(ZillowZip)
        private zillowZipRepo: Repository<any>,
        @InjectRepository(RealtorMetro)
        private realtorMetroRepo: Repository<any>,
        @InjectRepository(RealtorState)
        private realtorStateRepo: Repository<any>,
        @InjectRepository(RealtorCounty)
        private realtorCountyRepo: Repository<any>,
        @InjectRepository(RealtorZip)
        private realtorZipRepo: Repository<any>,
        @InjectRepository(RealtorNational)
        private realtorNationalRepo: Repository<any>,
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
        // Map metric to source and field
        const mapping = this.getMetricMapping(metricId);
        if (!mapping) {
            throw new Error(`Unknown metric: ${metricId}`);
        }

        // Get appropriate repository
        const repo = this.getRepository(mapping.source, geoLevel);
        if (!repo) {
            throw new Error(`No data available for ${metricId} at ${geoLevel} level`);
        }

        // Build query
        const query = repo
            .createQueryBuilder('t')
            .select('t.date', 'date')
            .addSelect(`t.${mapping.field}`, 'value')
            .where(this.getRegionFilter(geoLevel, regionId))
            .andWhere(`t.${mapping.field} IS NOT NULL`)
            .orderBy('t.date', 'DESC');

        // Add date filters if provided
        if (startDate) {
            query.andWhere('t.date >= :startDate', { startDate });
        }
        if (endDate) {
            query.andWhere('t.date <= :endDate', { endDate });
        }

        // Add limit if provided
        if (limit) {
            query.limit(limit);
        }

        const results = await query.getRawMany();

        // Reverse to get chronological order
        return results.reverse().map(r => ({
            date: r.date,
            value: Number(r.value),
        }));
    }

    /**
     * Get available date range for a metric/geography
     */
    async getAvailableDates(metricId: string, geoLevel: string): Promise<DateRange> {
        const mapping = this.getMetricMapping(metricId);
        if (!mapping) {
            throw new Error(`Unknown metric: ${metricId}`);
        }

        const repo = this.getRepository(mapping.source, geoLevel);
        if (!repo) {
            throw new Error(`No data available for ${metricId} at ${geoLevel} level`);
        }

        const result = await repo
            .createQueryBuilder('t')
            .select('MIN(t.date)', 'minDate')
            .addSelect('MAX(t.date)', 'maxDate')
            .addSelect('COUNT(DISTINCT t.date)', 'count')
            .where(`t.${mapping.field} IS NOT NULL`)
            .getRawOne();

        return {
            minDate: result.minDate,
            maxDate: result.maxDate,
            count: parseInt(result.count),
        };
    }

    /**
     * Map metric ID to database source and field name
     */
    private getMetricMapping(metricId: string): { source: string; field: string } | null {
        const mappings: Record<string, { source: string; field: string }> = {
            // Zillow ZHVI
            'home_value': { source: 'zillow', field: 'value' },

            // Zillow Forecast
            'home_price_forecast': { source: 'zillow_forecast', field: 'forecast_12m' },

            // Zillow Rent
            'rent_index': { source: 'zillow_rent', field: 'value' },

            // Zillow Renter Demand
            'rent_for_houses': { source: 'zillow_demand', field: 'value' },

            // Zillow Market Indicators
            'for_sale_inventory': { source: 'zillow_inventory', field: 'value' },
            'new_listings': { source: 'zillow_new_listings', field: 'value' },
            'pending_listings': { source: 'zillow_pending', field: 'value' },
            'home_sales': { source: 'zillow_sales', field: 'value' },
            'days_on_market': { source: 'zillow_days_pending', field: 'value' },
            'sale_to_list': { source: 'zillow_sale_to_list', field: 'value' },
            'market_heat': { source: 'zillow_market_heat', field: 'value' },

            // Zillow Price Cuts
            'price_cut_pct': { source: 'zillow_price_cuts', field: 'share_with_price_cut' },

            // Zillow New Construction
            'new_construction_sales': { source: 'zillow_new_construction', field: 'sales_count' },
            'new_construction_price': { source: 'zillow_new_construction', field: 'median_sale_price' },
            'new_construction_ppsf': { source: 'zillow_new_construction', field: 'price_per_sqft' },

            // Zillow Affordability
            'income_to_buy': { source: 'zillow_affordability', field: 'homeowner_income_needed' },
            'income_to_rent': { source: 'zillow_affordability', field: 'renter_income_needed' },
            'affordable_home_price': { source: 'zillow_affordability', field: 'affordable_home_price' },
            'years_to_save': { source: 'zillow_affordability', field: 'years_to_save' },
            'homeowner_affordability': { source: 'zillow_affordability', field: 'homeowner_affordability_percent' },
            'renter_affordability': { source: 'zillow_affordability', field: 'renter_affordability_percent' },

            // Realtor Listing Price
            'listing_price': { source: 'realtor', field: 'median_listing_price' },
            'price_per_sqft': { source: 'realtor', field: 'median_listing_price_per_square_foot' },

            // Realtor Growth Rates
            'home_value_yoy': { source: 'realtor', field: 'median_listing_price_yy' },
            'home_value_mom': { source: 'realtor', field: 'median_listing_price_mm' },

            // Realtor Inventory
            'inventory_yoy': { source: 'realtor', field: 'active_listing_count_yy' },
            'new_listings_yoy': { source: 'realtor', field: 'new_listing_count_yy' },

            // Realtor Market Metrics
            'pending_ratio': { source: 'realtor', field: 'pending_ratio' },
            'price_increase_pct': { source: 'realtor', field: 'price_increased_share' },
            'price_cut_pct': { source: 'realtor', field: 'price_reduced_share' },
            'home_sales_yoy': { source: 'realtor', field: 'sold_above_list_yy' },

            // Realtor Hotness Scores
            'hotness_score': { source: 'realtor_hotness', field: 'hotness_score' },
            'demand_score': { source: 'realtor_hotness', field: 'demand_score' },
            'supply_score': { source: 'realtor_hotness', field: 'supply_score' },

            // Calculated Metrics (these would need special handling or separate tables)
            'cap_rate': { source: 'calculated', field: 'cap_rate' },
            'overvalued_pct': { source: 'calculated', field: 'overvalued_pct' },
            'inventory_surplus': { source: 'calculated', field: 'inventory_surplus' },
            'home_value_5yr': { source: 'calculated', field: 'cagr_5yr' },

            // Census Demographics (if historical data exists)
            'population': { source: 'census', field: 'population' },
            'population_growth': { source: 'census', field: 'population_growth' },
            'median_income': { source: 'census', field: 'median_income' },
            'income_growth': { source: 'census', field: 'income_growth' },
            'median_age': { source: 'census', field: 'median_age' },
            'homeownership_rate': { source: 'census', field: 'homeownership_rate' },

            // Economic Indicators
            'unemployment_rate': { source: 'economic', field: 'unemployment_rate' },
            'job_growth': { source: 'economic', field: 'job_growth' },
            'gdp_growth': { source: 'economic', field: 'gdp_growth' },
            'cost_of_living': { source: 'economic', field: 'cost_of_living_index' },
        };

        return mappings[metricId] || null;
    }

    /**
     * Get the appropriate repository based on source and geography
     */
    private getRepository(source: string, geoLevel: string): Repository<any> | null {
        // Map source + geoLevel to repository
        const repoKey = `${source}_${geoLevel}`;

        // Zillow repositories
        if (source.startsWith('zillow')) {
            if (geoLevel === 'metro') return this.zillowMetroRepo;
            if (geoLevel === 'state') return this.zillowStateRepo;
            if (geoLevel === 'county') return this.zillowCountyRepo;
            if (geoLevel === 'zip') return this.zillowZipRepo;
        }

        // Realtor repositories
        if (source === 'realtor' || source === 'realtor_hotness') {
            if (geoLevel === 'national') return this.realtorNationalRepo;
            if (geoLevel === 'metro') return this.realtorMetroRepo;
            if (geoLevel === 'state') return this.realtorStateRepo;
            if (geoLevel === 'county') return this.realtorCountyRepo;
            if (geoLevel === 'zip') return this.realtorZipRepo;
        }

        // TODO: Add repositories for:
        // - calculated metrics
        // - census data
        // - economic indicators

        return null;
    }

    /**
     * Build WHERE clause for filtering by region
     */
    private getRegionFilter(geoLevel: string, regionId: string): string {
        switch (geoLevel) {
            case 'national':
                return "t.region_name = 'United States'";
            case 'state':
                return `t.region_name = '${regionId}'`;
            case 'metro':
                return `t.cbsa_code = '${regionId}'`;
            case 'county':
                return `t.county_fips = '${regionId}'`;
            case 'zip':
                return `t.postal_code = '${regionId}'`;
            case 'city':
                return `t.region_name = '${regionId}'`;
            default:
                return `t.region_id = '${regionId}'`;
        }
    }
}
