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
    getMetricConfig,
    isMetricSupportedForGeo,
    type GeoLevel,
} from '@/lib/data';
import { useEntitlements } from '@/lib/entitlements';
import { isMetricAvailableForGeo } from '@/app/map/config/metric-availability';
import { getMetricCategories, getAllOrderedMetricIds } from '@/app/map/config/metric-categories';

export interface MetricOption {
    label: string;
    value: string;
    category?: string;
    disabled?: boolean;
    /** Whether this metric is locked by entitlements (user lacks access) */
    locked?: boolean;
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
    // Homebuyer categories (from metric-categories.tsx)
    home_price_affordability: [
        'listing_price', 'income_to_buy', 'affordable_home_price',
        'price_per_sqft', 'years_to_save', 'home_value_yoy', 'home_value_5yr',
    ],
    market_activity: [
        'days_on_market', 'for_sale_inventory', 'inventory_yoy',
        'pending_ratio', 'new_listings_yoy', 'hotness_score', 'sale_to_list',
    ],
    pricing_deals: [
        'home_value_yoy', 'home_value_mom', 'price_cut_pct',
        'price_increase_pct', 'new_listings', 'inventory_surplus',
    ],

    // Investor categories (from metric-categories.tsx)
    cash_flow: [
        'cap_rate', 'rent_index', 'rent_for_houses',
        'listing_price', 'price_per_sqft',
    ],
    appreciation: ['home_value_yoy', 'home_value_5yr', 'home_value', 'overvalued_pct'],
    demand_risk: [
        'days_on_market', 'for_sale_inventory', 'inventory_yoy',
        'pending_ratio', 'new_listings_yoy', 'hotness_score',
    ],

    // Shared categories (from metric-categories.tsx)
    area_profile: [
        'population', 'population_growth', 'median_income',
        'income_growth', 'median_age', 'homeownership_rate',
    ],
    local_economy: [
        'unemployment_rate', 'job_growth', 'gdp_growth', 'cost_of_living',
    ],
    new_construction: [
        'sf_permits', 'mf_permits', 'total_permits', 'permits_yoy',
        'sf_mf_ratio', 'permit_value_per_unit',
        'new_construction_sales', 'new_construction_price', 'new_construction_ppsf',
    ],
    scores: [
        'homeready_score', 'investoredge_score', 'market_health_score',
    ],
};

/**
 * Get metric options for dropdowns/selectors
 */
export function useMetricOptions(config: MetricOptionsConfig = {}): MetricOptionsResult {
    const { category, geoLevel, premiumFilter = 'all', metricIds } = config;
    const { isMetricGated } = useEntitlements();

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

            // Check geo level support using verified availability (actual data availability)
            // Falls back to config-based check if availability data not found
            if (geoLevel) {
                const isAvailable = isMetricAvailableForGeo(id, geoLevel);
                if (!isAvailable) {
                    // If not in availability map, fall back to config check
                    const configSupported = isMetricSupportedForGeo(id, geoLevel);
                    if (!configSupported) {
                        continue;
                    }
                }
            }

            // Check premium filter using entitlements
            const locked = isMetricGated(id);
            if (premiumFilter === 'premium' && !locked) continue;
            if (premiumFilter === 'free' && locked) continue;

            result.push({
                label: metricConfig.title,
                value: id,
                category: category,

                disabled: false,
                locked,
            });
        }

        // Sort alphabetically by label
        return result.sort((a, b) => a.label.localeCompare(b.label));
    }, [category, geoLevel, premiumFilter, metricIds, isMetricGated]);

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
 * IMPORTANT: This list must match metric-categories.tsx exactly
 */
export function useAllMetricOptions(geoLevel?: GeoLevel): MetricOptionsResult {
    // Master ordered list matching map page sidebar (metric-categories.tsx)
    const ORDERED_IDS = useMemo(() => getAllOrderedMetricIds(), []);
    const { isMetricGated } = useEntitlements();

    const options = useMemo(() => {
        const result: MetricOption[] = [];
        const seen = new Set<string>();

        // Add ordered metrics first
        for (const id of ORDERED_IDS) {
            if (seen.has(id)) continue;

            const metricConfig = getMetricConfig(id);
            if (!metricConfig) continue;

            // Check geo level support using verified availability (actual data availability)
            // Falls back to config-based check if availability data not found
            let isAvailable = true;
            if (geoLevel) {
                isAvailable = isMetricAvailableForGeo(id, geoLevel);
                // If not in availability map, fall back to config check
                if (!isAvailable) {
                    isAvailable = isMetricSupportedForGeo(id, geoLevel);
                }
            }

            if (!isAvailable) {
                // Add as disabled instead of skipping
                const locked = isMetricGated(id);
                result.push({
                    label: metricConfig.title,
                    value: id,
    
                    disabled: true,
                    locked,
                });
                seen.add(id);
                continue;
            }

            seen.add(id);
            const locked = isMetricGated(id);
            result.push({
                label: metricConfig.title,
                value: id,

                disabled: false,
                locked,
            });
        }

        // Add any remaining metrics from METRICS config
        for (const id of Object.keys(METRICS)) {
            if (seen.has(id)) continue;
            seen.add(id);

            const metricConfig = getMetricConfig(id);
            if (!metricConfig) continue;

            // Check geo level support using verified availability (actual data availability)
            // Falls back to config-based check if availability data not found
            let disabled = false;
            if (geoLevel) {
                disabled = !isMetricAvailableForGeo(id, geoLevel);
                // If not in availability map, fall back to config check
                if (disabled) {
                    disabled = !isMetricSupportedForGeo(id, geoLevel);
                }
            }

            const locked = isMetricGated(id);
            result.push({
                label: metricConfig.title,
                value: id,

                disabled,
                locked,
            });
        }

        return result;
    }, [geoLevel, isMetricGated]);

    return {
        options,
        loading: false,
    };
}
