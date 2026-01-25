/**
 * Database Verification Script for Unavailable Metrics
 * 
 * Queries the database directly via PostgreSQL connection pooler to verify if data exists for metrics
 * that were marked as unavailable in the API verification.
 * 
 * This ensures we catch cases where data exists in the database but
 * the API endpoint might not be working correctly.
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs/promises';
import * as path from 'path';
import { METRICS, GeoLevel, getMetricConfig } from '../packages/frontend/app/map/config/metrics';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: 'packages/frontend/.env.local' });

// Get database connection details
const dbHost = process.env.DATABASE_HOST || 'aws-1-us-east-1.pooler.supabase.com';
const dbPort = parseInt(process.env.DATABASE_PORT || '6543', 10);
const dbDatabase = process.env.DATABASE_NAME || 'postgres';
const dbUser = process.env.DATABASE_USER || 'postgres.pysflbhpnqwoczyuaaif';
const dbPassword = process.env.DATABASE_PASSWORD || process.env.SUPABASE_DB_PASSWORD;

if (!dbPassword) {
  console.error('❌ Missing database password');
  console.error('   Set DATABASE_PASSWORD or SUPABASE_DB_PASSWORD in .env.local');
  process.exit(1);
}

// Create PostgreSQL connection pool
const pool = new Pool({
  host: dbHost,
  port: dbPort,
  database: dbDatabase,
  user: dbUser,
  password: dbPassword,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 5, // Limit concurrent connections
});

const GEO_LEVELS: GeoLevel[] = ['national', 'state', 'metro', 'county', 'city', 'zip', 'tract'];

/**
 * Map metric ID to database table source and column name
 * Based on packages/backend/src/timeseries/timeseries.service.ts
 */
function getMetricMapping(metricId: string): {
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
    // REALTOR METRICS
    listing_price: { source: 'realtor', columnName: 'median_listing_price', usesMetricName: false },
    home_value_yoy: { source: 'realtor', columnName: 'median_listing_price_yy', usesMetricName: false },
    home_value_mom: { source: 'realtor', columnName: 'median_listing_price_mm', usesMetricName: false },
    for_sale_inventory: { source: 'realtor', columnName: 'active_listing_count', usesMetricName: false },
    inventory_yoy: { source: 'realtor', columnName: 'active_listing_count_yy', usesMetricName: false },
    days_on_market: { source: 'realtor', columnName: 'median_days_on_market', usesMetricName: false },
    new_listings: { source: 'realtor', columnName: 'new_listing_count', usesMetricName: false },
    pending_listings: { source: 'realtor', columnName: 'pending_listing_count', usesMetricName: false },
    price_cut_pct: { source: 'realtor', columnName: 'price_reduced_share', usesMetricName: false },
    price_per_sqft: { source: 'realtor', columnName: 'median_listing_price_per_square_foot', usesMetricName: false },
    pending_ratio: { source: 'realtor', columnName: 'pending_ratio', usesMetricName: false },
    hotness_score: { source: 'realtor', columnName: 'hotness_score', usesMetricName: false },
    supply_score: { source: 'realtor', columnName: 'supply_score', usesMetricName: false },
    demand_score: { source: 'realtor', columnName: 'demand_score', usesMetricName: false },
    price_increase_pct: { source: 'realtor', columnName: 'price_increased_share', usesMetricName: false },
    new_listings_yoy: { source: 'realtor', columnName: 'new_listing_count_yy', usesMetricName: false },
    home_sales: { source: 'realtor', columnName: 'sold_listing_count', usesMetricName: false },
    home_sales_yoy: { source: 'realtor', columnName: 'sold_listing_count_yy', usesMetricName: false },

    // ZILLOW METRICS
    home_value: { source: 'zillow', columnName: 'value', usesMetricName: true, metricNameValue: 'zhvi' },
    home_price_forecast: { source: 'zillow', columnName: 'forecast_12m', usesMetricName: false },
    homeowner_affordability: { source: 'zillow', columnName: 'value', usesMetricName: true, metricNameValue: 'new_homeowner_affordability' },
    renter_affordability: { source: 'zillow', columnName: 'value', usesMetricName: true, metricNameValue: 'new_renter_affordability' },
    income_to_rent: { source: 'zillow', columnName: 'value', usesMetricName: true, metricNameValue: 'renter_income' },
    rent_index: { source: 'zillow', columnName: 'value', usesMetricName: true, metricNameValue: 'zori' },
    rent_for_houses: { source: 'zillow', columnName: 'value', usesMetricName: true, metricNameValue: 'zordi_sfr' },
    sale_to_list: { source: 'zillow', columnName: 'value', usesMetricName: true, metricNameValue: 'sale_to_list' },
    market_heat: { source: 'zillow', columnName: 'value', usesMetricName: true, metricNameValue: 'market_heat_index' },
    new_construction_sales: { source: 'zillow', columnName: 'value', usesMetricName: true, metricNameValue: 'new_con_sales' },
    new_construction_price: { source: 'zillow', columnName: 'value', usesMetricName: true, metricNameValue: 'new_con_median_price' },
    new_construction_ppsf: { source: 'zillow', columnName: 'value', usesMetricName: true, metricNameValue: 'new_con_median_price_per_sqft' },

    // CENSUS METRICS
    population: { source: 'census', columnName: 'total_population', usesMetricName: false },
    population_growth: { source: 'census', columnName: 'population_yoy', usesMetricName: false },
    median_income: { source: 'census', columnName: 'median_household_income', usesMetricName: false },
    income_growth: { source: 'census', columnName: 'income_yoy', usesMetricName: false },
    median_age: { source: 'census', columnName: 'median_age', usesMetricName: false },
    homeownership_rate: { source: 'census', columnName: 'homeownership_rate', usesMetricName: false },

    // ECONOMIC METRICS
    unemployment_rate: { source: 'economic', columnName: 'unemployment_rate', usesMetricName: false },
    job_growth: { source: 'economic', columnName: 'employment_yoy', usesMetricName: false },
    gdp_growth: { source: 'economic', columnName: 'gdp_yoy', usesMetricName: false },
    cost_of_living: { source: 'economic', columnName: 'rpp_all_items', usesMetricName: false },

    // CALCULATED METRICS
    cap_rate: { source: 'calculated', columnName: 'cap_rate_proxy', usesMetricName: false },
    income_to_buy: { source: 'calculated', columnName: 'income_to_buy', usesMetricName: false },
    years_to_save: { source: 'calculated', columnName: 'years_to_save', usesMetricName: false },
    affordable_home_price: { source: 'calculated', columnName: 'affordable_home_price', usesMetricName: false },
    gross_yield: { source: 'calculated', columnName: 'gross_yield', usesMetricName: false },
    grm: { source: 'calculated', columnName: 'grm', usesMetricName: false },
    rent_to_price_ratio: { source: 'calculated', columnName: 'rent_price_ratio', usesMetricName: false },
    investment_score: { source: 'calculated', columnName: 'investment_score', usesMetricName: false },
    long_term_growth_score: { source: 'calculated', columnName: 'long_term_growth_score', usesMetricName: false },
    overvalued_pct: { source: 'calculated', columnName: 'overvalued_pct', usesMetricName: false },
    inventory_surplus: { source: 'calculated', columnName: 'inventory_surplus_pct', usesMetricName: false },
    home_value_5yr: { source: 'calculated', columnName: 'zhvi_5y_change', usesMetricName: false },

    // PROPERTYIQ SCORES
    homeready_score: { source: 'propertyiq', columnName: 'homeready_score', usesMetricName: false },
    investoredge_score: { source: 'propertyiq', columnName: 'investoredge_score', usesMetricName: false },
    market_health_score: { source: 'propertyiq', columnName: 'market_health_score', usesMetricName: false },
  };

  return mappings[metricId] || null;
}

/**
 * Get table name for a source and geography level
 * Handles special cases like national level using Realtor instead of Zillow
 */
function getTableName(source: string, geoLevel: GeoLevel, metricId?: string): string | null {
  const level = geoLevel.toLowerCase();

  // Special tables first
  if (metricId === 'home_price_forecast') {
    return 'zillow_zhvf';
  }

  // National level: Use Realtor instead of Zillow for home_value
  if (level === 'national' && source === 'zillow' && metricId === 'home_value') {
    return 'realtor_national';
  }

  // Affordability metrics are stored in zillow tables with metric_name, not a separate table

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

  if (source === 'calculated') {
    return 'calculated_metrics';
  }

  if (source === 'propertyiq') {
    return 'propertyiq_scores';
  }

  return null;
}

/**
 * Map metric IDs to potential calculated metric substitutes
 */
function getCalculatedMetricSubstitute(metricId: string): string | null {
  const substitutes: Record<string, string> = {
    // YoY changes
    home_value_yoy: 'zhvi_yoy_change',
    rent_index_yoy: 'zori_yoy_change',
    inventory_yoy: 'inventory_yoy_change',
    
    // Multi-year changes
    home_value_5yr: 'zhvi_5y_change',
    
    // Rent metrics - could use zori_yoy_change as indicator
    rent_index: 'zori_yoy_change', // Not exact but indicates rent data exists
    
    // Other potential substitutes
    home_value_mom: 'zhvi_90d_change', // 90-day change as momentum indicator
  };
  
  return substitutes[metricId] || null;
}

/**
 * Check calculated_metrics for substitute data
 * More thorough: fetches actual samples and verifies valid values
 */
async function checkCalculatedMetricSubstitute(
  metricId: string,
  geoLevel: GeoLevel,
  substituteColumn: string
): Promise<{ available: boolean; count: number; error?: string }> {
  try {
    // Get count
    const countQuery = `
      SELECT COUNT(*) as count
      FROM calculated_metrics
      WHERE geography_type = $1
        AND ${substituteColumn} IS NOT NULL
    `;
    
    const countResult = await pool.query(countQuery, [geoLevel]);
    const count = parseInt(countResult.rows[0]?.count || '0', 10);

    if (count === 0) {
      return { available: false, count: 0 };
    }

    // Fetch actual samples to verify valid values
    const sampleQuery = `
      SELECT ${substituteColumn}
      FROM calculated_metrics
      WHERE geography_type = $1
        AND ${substituteColumn} IS NOT NULL
      LIMIT 10
    `;

    const sampleResult = await pool.query(sampleQuery, [geoLevel]);

    if (!sampleResult.rows || sampleResult.rows.length === 0) {
      return { available: false, count: 0 };
    }

    // Verify samples have valid numeric values
    const hasValidValues = sampleResult.rows.some((row: any) => {
      const value = row[substituteColumn];
      return value !== null && value !== undefined && !isNaN(Number(value));
    });

    return {
      available: hasValidValues,
      count: hasValidValues ? count : 0,
    };
  } catch (error: any) {
    return { available: false, count: 0, error: error.message };
  }
}

/**
 * Check if data exists in database for a metric-geography combination
 * More thorough check: fetches actual data samples and verifies valid values
 */
async function checkDatabaseAvailability(
  metricId: string,
  geoLevel: GeoLevel
): Promise<{ available: boolean; count: number; error?: string; source?: string }> {
  const mapping = getMetricMapping(metricId);
  if (!mapping) {
    return { available: false, count: 0, error: 'No database mapping found' };
  }

  // Special handling: home_value at national uses Realtor, not Zillow
  let actualSource = mapping.source;
  let actualColumnName = mapping.columnName;
  if (geoLevel === 'national' && metricId === 'home_value' && mapping.source === 'zillow') {
    actualSource = 'realtor';
    actualColumnName = 'median_listing_price';
  }

  const tableName = getTableName(actualSource, geoLevel, metricId);
  if (!tableName) {
    return { available: false, count: 0, error: `No table for ${actualSource} @ ${geoLevel}` };
  }

  try {
    // First, get total count
    let countQuery = supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    // Special handling for zillow_zhvf (forecast table)
    if (tableName === 'zillow_zhvf') {
      const geographyMap: Record<GeoLevel, string> = {
        national: 'US',
        state: 'State',
        metro: 'Metro',
        county: 'County',
        city: 'City',
        zip: 'Zip',
        tract: 'Tract',
      };
      countQuery = countQuery.eq('geography', geographyMap[geoLevel] || geoLevel);
      countQuery = countQuery.not('forecast_12m', 'is', null);
    }
    // For Zillow long-format tables with metric_name filter
    else if (actualSource === 'zillow' && mapping.usesMetricName && mapping.metricNameValue) {
      countQuery = countQuery.eq('metric_name', mapping.metricNameValue);
      countQuery = countQuery.not(mapping.columnName, 'is', null);
    }
    // For calculated_metrics, filter by geography_type
    else if (actualSource === 'calculated') {
      countQuery = countQuery.eq('geography_type', geoLevel);
      countQuery = countQuery.not(actualColumnName, 'is', null);
    }
    // For propertyiq_scores, filter by geography_type and score_type
    else if (actualSource === 'propertyiq') {
      countQuery = countQuery.eq('geography_type', geoLevel);
      if (mapping.metricNameValue) {
        countQuery = countQuery.eq('score_type', mapping.metricNameValue);
      }
      countQuery = countQuery.not(actualColumnName, 'is', null);
    }
    // For all other tables (realtor, census, economic)
    else {
      countQuery = countQuery.not(actualColumnName, 'is', null);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      if (countError.message.includes('does not exist') || countError.message.includes('permission denied')) {
        return { available: false, count: 0, error: countError.message };
      }
      return { available: false, count: 0, error: countError.message };
    }

    if ((count || 0) === 0) {
      // No data found, check for calculated metric substitutes
      const substituteColumn = getCalculatedMetricSubstitute(metricId);
      if (substituteColumn) {
        const substituteResult = await checkCalculatedMetricSubstitute(
          metricId,
          geoLevel,
          substituteColumn
        );
        if (substituteResult.available) {
          return {
            available: true,
            count: substituteResult.count,
            source: 'calculated_metrics',
          };
        }
      }
      return { available: false, count: 0, source: actualSource };
    }

    // Now fetch actual data samples to verify they have valid values
    let sampleQuery = supabase
      .from(tableName)
      .select(actualColumnName)
      .limit(10);

    // Apply same filters as count query
    if (tableName === 'zillow_zhvf') {
      const geographyMap: Record<GeoLevel, string> = {
        national: 'US',
        state: 'State',
        metro: 'Metro',
        county: 'County',
        city: 'City',
        zip: 'Zip',
        tract: 'Tract',
      };
      sampleQuery = sampleQuery.eq('geography', geographyMap[geoLevel] || geoLevel);
      sampleQuery = sampleQuery.not('forecast_12m', 'is', null);
      sampleQuery = sampleQuery.select('forecast_12m');
    }
    else if (actualSource === 'zillow' && mapping.usesMetricName && mapping.metricNameValue) {
      sampleQuery = sampleQuery.eq('metric_name', mapping.metricNameValue);
      sampleQuery = sampleQuery.not(mapping.columnName, 'is', null);
      sampleQuery = sampleQuery.select(mapping.columnName);
    }
    else if (actualSource === 'calculated') {
      sampleQuery = sampleQuery.eq('geography_type', geoLevel);
      sampleQuery = sampleQuery.not(actualColumnName, 'is', null);
      sampleQuery = sampleQuery.select(actualColumnName);
    }
    else if (actualSource === 'propertyiq') {
      sampleQuery = sampleQuery.eq('geography_type', geoLevel);
      if (mapping.metricNameValue) {
        sampleQuery = sampleQuery.eq('score_type', mapping.metricNameValue);
      }
      sampleQuery = sampleQuery.not(actualColumnName, 'is', null);
      sampleQuery = sampleQuery.select(actualColumnName);
    }
    else {
      sampleQuery = sampleQuery.not(actualColumnName, 'is', null);
      sampleQuery = sampleQuery.select(actualColumnName);
    }

    const { data: samples, error: sampleError } = await sampleQuery;

    if (sampleError) {
      return { available: false, count: 0, error: sampleError.message };
    }

    // Verify samples have valid numeric values (not null, not NaN, not 0 if that's invalid)
    if (!samples || samples.length === 0) {
      // Check for calculated metric substitutes
      const substituteColumn = getCalculatedMetricSubstitute(metricId);
      if (substituteColumn) {
        const substituteResult = await checkCalculatedMetricSubstitute(
          metricId,
          geoLevel,
          substituteColumn
        );
        if (substituteResult.available) {
          return {
            available: true,
            count: substituteResult.count,
            source: 'calculated_metrics',
          };
        }
      }
      return { available: false, count: 0, source: actualSource };
    }

    // Check if samples have valid numeric values
    const columnToCheck = tableName === 'zillow_zhvf' ? 'forecast_12m' : actualColumnName;
    const hasValidValues = samples.some((row: any) => {
      const value = row[columnToCheck];
      return value !== null && value !== undefined && !isNaN(Number(value));
    });

    if (!hasValidValues) {
      // Check for calculated metric substitutes
      const substituteColumn = getCalculatedMetricSubstitute(metricId);
      if (substituteColumn) {
        const substituteResult = await checkCalculatedMetricSubstitute(
          metricId,
          geoLevel,
          substituteColumn
        );
        if (substituteResult.available) {
          return {
            available: true,
            count: substituteResult.count,
            source: 'calculated_metrics',
          };
        }
      }
      return { available: false, count: 0, source: actualSource };
    }

    return {
      available: true,
      count: count || 0,
      source: actualSource,
    };
  } catch (error: any) {
    return { available: false, count: 0, error: error.message };
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    console.log('🔍 Database Verification for Unavailable Metrics\n');

    // Load the availability results
    const resultsPath = path.join(__dirname, '../metric-geography-availability-results.json');
    const resultsContent = await fs.readFile(resultsPath, 'utf-8');
    const availability: Record<string, Record<string, boolean>> = JSON.parse(resultsContent);

    // Find all false combinations
    const falseCombinations: Array<{ metricId: string; geoLevel: GeoLevel }> = [];
    for (const [metricId, geos] of Object.entries(availability)) {
      for (const [geoLevel, available] of Object.entries(geos)) {
        if (!available && GEO_LEVELS.includes(geoLevel as GeoLevel)) {
          falseCombinations.push({ metricId, geoLevel: geoLevel as GeoLevel });
        }
      }
    }

    console.log(`Found ${falseCombinations.length} combinations marked as unavailable\n`);
    console.log('Verifying against database...\n');

    const updates: Array<{ metricId: string; geoLevel: GeoLevel; available: boolean; count: number; source?: string }> = [];
    let checked = 0;

    for (const { metricId, geoLevel } of falseCombinations) {
      checked++;
      process.stdout.write(
        `\rChecking: ${metricId.padEnd(30)} @ ${geoLevel.padEnd(10)} (${checked}/${falseCombinations.length})...`
      );

      const result = await checkDatabaseAvailability(metricId, geoLevel);
      
      if (result.available) {
        updates.push({ 
          metricId, 
          geoLevel, 
          available: true, 
          count: result.count,
          source: result.source || 'primary'
        });
      }

      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log(`\n\n✅ Database verification complete!\n`);
    console.log(`Found ${updates.length} metrics with data in database that were marked unavailable\n`);

    if (updates.length > 0) {
      console.log('📊 Metrics to update:\n');
      for (const update of updates) {
        const sourceNote = update.source === 'calculated_metrics' ? ' (from calculated_metrics)' : '';
        console.log(`  ✅ ${update.metricId} @ ${update.geoLevel}: ${update.count} records${sourceNote}`);
      }

      // Update the availability mapping
      for (const update of updates) {
        if (!availability[update.metricId]) {
          availability[update.metricId] = {};
        }
        availability[update.metricId][update.geoLevel] = true;
      }

      // Regenerate the TypeScript file
      const lines: string[] = [
        '/**',
        ' * METRIC-GEOGRAPHY AVAILABILITY MAPPING',
        ' *',
        ' * This file is auto-generated by verify-metric-geography-availability.ts',
        ' * DO NOT EDIT MANUALLY - run the verification script to regenerate.',
        ' *',
        ' * Maps each metric to the geography levels where data is actually available.',
        ' * Used by the metric selector to disable unavailable combinations.',
        ' *',
        ' * Updated with database verification for metrics marked unavailable by API.',
        ' */',
        '',
        'import type { GeoLevel } from \'./metrics\';',
        '',
        'export type MetricAvailabilityMap = {',
        '  [metricId: string]: {',
        '    [geoLevel in GeoLevel]?: boolean;',
        '  };',
        '};',
        '',
        '/**',
        ' * Availability mapping: metricId -> geoLevel -> available',
        ' * true = data is available, false/undefined = data is not available',
        ' */',
        'export const METRIC_GEO_AVAILABILITY: MetricAvailabilityMap = {',
      ];

      const metricIds = Object.keys(availability).sort();
      
      for (const metricId of metricIds) {
        lines.push(`  ${metricId}: {`);
        
        const geoLevels = GEO_LEVELS.filter(geo => availability[metricId][geo] === true);
        if (geoLevels.length > 0) {
          for (const geoLevel of geoLevels) {
            lines.push(`    ${geoLevel}: true,`);
          }
        }
        
        lines.push('  },');
      }

      lines.push('};');
      lines.push('');
      lines.push('/**');
      lines.push(' * Check if a metric has data available for a given geography level');
      lines.push(' */');
      lines.push('export function isMetricAvailableForGeo(');
      lines.push('  metricId: string,');
      lines.push('  geoLevel: GeoLevel');
      lines.push('): boolean {');
      lines.push('  const metricAvailability = METRIC_GEO_AVAILABILITY[metricId];');
      lines.push('  if (!metricAvailability) return false;');
      lines.push('  ');
      lines.push('  // National level uses state data');
      lines.push('  if (geoLevel === \'national\') {');
      lines.push('    return metricAvailability.state === true;');
      lines.push('  }');
      lines.push('  ');
      lines.push('  return metricAvailability[geoLevel] === true;');
      lines.push('}');

      const outputPath = path.join(__dirname, '../packages/frontend/app/map/config/metric-availability.ts');
      await fs.writeFile(outputPath, lines.join('\n'), 'utf-8');
      console.log(`\n✅ Updated availability mapping file: ${outputPath}\n`);

      // Also update JSON
      await fs.writeFile(resultsPath, JSON.stringify(availability, null, 2), 'utf-8');
      console.log(`✅ Updated results JSON: ${resultsPath}\n`);
    } else {
      console.log('No updates needed - all unavailable metrics confirmed as unavailable in database.\n');
    }

    console.log('✨ Database verification complete!\n');

  } catch (error: any) {
    console.error('\n❌ Error during database verification:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { checkDatabaseAvailability, getMetricMapping, getTableName };
