/**
 * useMetricOptions - Dropdown/Selector Hook
 *
 * Provides options for dropdown menus and selectors based on:
 * - Metric categories (what data types are available)
 * - Geography levels (what regions have data for a metric)
 *
 * Usage for metric dropdown:
 *   const { options } = useMetricOptions({
 *     category: 'market_activity',
 *     geoLevel: 'metro',
 *   });
 *
 * Usage for geography dropdown:
 *   const { options } = useMetricOptions({
 *     type: 'geography',
 *     metricId: 'home_value',
 *     geoLevel: 'metro',
 *   });
 */

'use client';

import { useMemo } from 'react';
import {
    METRICS,
    GeoLevel,
    getMetricConfig,
    isMetricSupportedForGeo,
} from '@/app/map/config/metrics';
import { getMetricCategories } from '@/app/map/config/metric-categories';

export interface MetricOption {
    label: string;
    value: string;
    category?: string;
    isPremium?: boolean;
    disabled?: boolean;
}

export interface MetricOptionsConfig {
    /** Filter by category (e.g., 'market_activity', 'affordability') */
    category?: string;
    /** Only include metrics available at this geo level */
    geoLevel?: GeoLevel;
    /** Filter to show only premium or only free metrics */
    premiumFilter?: 'all' | 'premium' | 'free';
    /** Specific metric IDs to include (overrides category filter) */
    metricIds?: string[];
}

export interface MetricOptionsResult {
    options: MetricOption[];
    loading: boolean;
}

// Category mapping based on metric-categories.tsx structure
const CATEGORY_METRICS: Record<string, string[]> = {
    // Homebuyer categories
    home_price_affordability: [
        'listing_price', 'income_to_buy', 'affordable_home_price',
        'price_per_sqft', 'years_to_save', 'homeowner_affordability',
        'home_value_yoy', 'home_value_5yr',
    ],
    market_activity: [
        'days_on_market', 'for_sale_inventory', 'inventory_yoy',
        'pending_ratio', 'new_listings_yoy', 'hotness_score',
        'market_heat', 'sale_to_list',
    ],
    pricing_deals: [
        'home_value_mom', 'home_price_forecast', 'price_cut_pct',
        'price_increase_pct', 'new_listings', 'inventory_surplus',
    ],

    // Investor categories
    cash_flow: [
        'cap_rate', 'rent_index', 'rent_for_houses',
        'income_to_rent', 'renter_affordability',
    ],
    appreciation: ['home_value', 'overvalued_pct'],
    demand_risk: [
        'days_on_market', 'for_sale_inventory', 'demand_score', 'supply_score',
    ],

    // Area categories
    area_profile: [
        'population', 'population_growth', 'median_income',
        'income_growth', 'median_age', 'homeownership_rate',
    ],
    local_economy: [
        'unemployment_rate', 'job_growth', 'gdp_growth', 'cost_of_living',
    ],
    new_construction: [
        'new_construction_sales', 'new_construction_price', 'new_construction_ppsf',
    ],
};

// Premium metrics (should eventually come from backend)
const PREMIUM_METRICS = new Set([
    'years_to_save', 'homeowner_affordability', 'home_value_5yr',
    'sale_to_list', 'home_value_mom', 'home_price_forecast', 'inventory_surplus',
    'cap_rate', 'renter_affordability', 'overvalued_pct',
    'population_growth', 'income_growth', 'median_age', 'homeownership_rate',
    'job_growth', 'gdp_growth', 'cost_of_living',
    'new_construction_ppsf',
]);

/**
 * Get metric options for dropdowns/selectors
 */
export function useMetricOptions(config: MetricOptionsConfig = {}): MetricOptionsResult {
    const { category, geoLevel, premiumFilter = 'all', metricIds } = config;

    const options = useMemo(() => {
        let ids: string[];

        // Start with specific metric IDs if provided
        if (metricIds && metricIds.length > 0) {
            ids = metricIds;
        }
        // Or filter by category
        else if (category && CATEGORY_METRICS[category]) {
            ids = CATEGORY_METRICS[category];
        }
        // Or use all metrics
        else {
            ids = Object.keys(METRICS);
        }

        // Filter and map to options
        const result: MetricOption[] = [];
        const seen = new Set<string>();

        for (const id of ids) {
            if (seen.has(id)) continue;
            seen.add(id);

            const metricConfig = getMetricConfig(id);
            if (!metricConfig) continue;

            // Check geo level support
            if (geoLevel && !isMetricSupportedForGeo(id, geoLevel)) {
                continue;
            }

            // Check premium filter
            const isPremium = PREMIUM_METRICS.has(id);
            if (premiumFilter === 'premium' && !isPremium) continue;
            if (premiumFilter === 'free' && isPremium) continue;

            result.push({
                label: metricConfig.title,
                value: id,
                category: category,
                isPremium,
                disabled: false,
            });
        }

        // Sort alphabetically by label
        return result.sort((a, b) => a.label.localeCompare(b.label));
    }, [category, geoLevel, premiumFilter, metricIds]);

    return {
        options,
        loading: false, // Static data, no loading state needed
    };
}

/**
 * Get all available metric categories
 */
export function useMetricCategories(): { label: string; value: string }[] {
    return useMemo(() => Object.keys(CATEGORY_METRICS).map(key => ({
        label: key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
        value: key,
    })), []);
}

/**
 * Get all metrics matching sidebar order (for main metric dropdown)
 */
export function useAllMetricOptions(geoLevel?: GeoLevel): MetricOptionsResult {
  // Master ordered list matching map page sidebar
  const ORDERED_IDS = [
    // Affordability
    'listing_price', 'income_to_buy', 'affordable_home_price', 'price_per_sqft',
    'years_to_save', 'homeowner_affordability', 'home_value_yoy', 'home_value_5yr',
    // Market Competition
    'days_on_market', 'for_sale_inventory', 'inventory_yoy', 'pending_ratio',
    'new_listings_yoy', 'hotness_score', 'market_heat', 'sale_to_list',
    // Pricing & Deals
    'home_value_mom', 'home_price_forecast', 'price_cut_pct', 'price_increase_pct',
    'new_listings', 'inventory_surplus',
    // Cash Flow
    'cap_rate', 'gross_yield', 'grm', 'rent_to_price_ratio', 'rent_index', 'rent_for_houses', 'income_to_rent', 'renter_affordability',
    // Appreciation
    'home_value', 'overvalued_pct',
    // Investment Scores
    'investment_score', 'long_term_growth_score',
    // Demand & Risk
    'demand_score', 'supply_score',
    // Area Profile
    'population', 'population_growth', 'median_income', 'income_growth',
    'median_age', 'homeownership_rate',
    // Local Economy
    'unemployment_rate', 'job_growth', 'gdp_growth', 'cost_of_living',
    // New Construction
    'new_construction_sales', 'new_construction_price', 'new_construction_ppsf',
    // PropertyIQ Scores
    'homeready_score', 'investoredge_score', 'market_health_score',
  ];

    const options = useMemo(() => {
        const result: MetricOption[] = [];
        const seen = new Set<string>();

        // Add ordered metrics first
        for (const id of ORDERED_IDS) {
            if (seen.has(id)) continue;

            const metricConfig = getMetricConfig(id);
            if (!metricConfig) continue;

            // Check geo level support if specified
            if (geoLevel && !isMetricSupportedForGeo(id, geoLevel)) {
                // Add as disabled instead of skipping
                result.push({
                    label: metricConfig.title,
                    value: id,
                    isPremium: PREMIUM_METRICS.has(id),
                    disabled: true,
                });
                seen.add(id);
                continue;
            }

            seen.add(id);
            result.push({
                label: metricConfig.title,
                value: id,
                isPremium: PREMIUM_METRICS.has(id),
                disabled: false,
            });
        }

        // Add any remaining metrics from METRICS config
        for (const id of Object.keys(METRICS)) {
            if (seen.has(id)) continue;
            seen.add(id);

            const metricConfig = getMetricConfig(id);
            if (!metricConfig) continue;

            const disabled = geoLevel ? !isMetricSupportedForGeo(id, geoLevel) : false;

            result.push({
                label: metricConfig.title,
                value: id,
                isPremium: PREMIUM_METRICS.has(id),
                disabled,
            });
        }

        return result;
    }, [geoLevel]);

    return {
        options,
        loading: false,
    };
}
