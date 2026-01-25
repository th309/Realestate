/**
 * Comprehensive Metric-Geography Availability Verification Script
 * 
 * Tests every metric-geography combination using the data binding layer
 * (fetchMetricData) to verify actual data availability. This ensures the metric
 * selector only shows metrics that have data for the selected geography.
 * 
 * Uses the same data fetching mechanism as the frontend for consistency.
 */

import { METRICS, GeoLevel, getMetricConfig, getGeoPathSegment } from '../packages/frontend/app/map/config/metrics';
// fetchMetricData imported dynamically after setting API URL

const GEO_LEVELS: GeoLevel[] = ['national', 'state', 'metro', 'county', 'city', 'zip', 'tract'];

interface AvailabilityResult {
  metricId: string;
  geoLevel: GeoLevel;
  available: boolean;
  error?: string;
  dataCount?: number;
  responseTime?: number;
}

interface MetricAvailability {
  [metricId: string]: {
    [geoLevel: string]: boolean;
  };
}

/**
 * Test if data is available for a metric-geography combination using ONLY the data binding layer
 * This is the same mechanism the frontend uses, so results will match exactly.
 */
async function testMetricGeoAvailability(
  metricId: string,
  geoLevel: GeoLevel,
  fetchMetricDataFn: typeof import('../packages/frontend/app/map/config/fetchMetricData').fetchMetricData
): Promise<AvailabilityResult> {
  const startTime = Date.now();

  try {
    // Use ONLY the data binding layer - same as frontend
    // For city and zip, use CA as test state (most populated, likely to have data)
    const options = (geoLevel === 'city' || geoLevel === 'zip') 
      ? { state: 'CA' }
      : undefined;

    // Set a timeout using Promise.race
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 30000); // 30 second timeout
    });

    const fetchPromise = fetchMetricDataFn(metricId, geoLevel, options);
    
    const metricData = await Promise.race([fetchPromise, timeoutPromise]);
    const responseTime = Date.now() - startTime;

    // Check if we actually have data with valid values
    // This is what the frontend would see - if fetchMetricData returns data, it's available
    const dataCount = Object.keys(metricData).filter(key => {
      const entry = metricData[key];
      return entry && 
             typeof entry.value === 'number' && 
             !isNaN(entry.value) && 
             isFinite(entry.value);
    }).length;

    return {
      metricId,
      geoLevel,
      available: dataCount > 0,
      dataCount,
      responseTime,
    };
  } catch (error: any) {
    const responseTime = Date.now() - startTime;
    
    // Network errors, timeouts, etc. mean data is not available
    if (error.message === 'Request timeout' || error.name === 'TimeoutError') {
      return {
        metricId,
        geoLevel,
        available: false,
        error: 'Request timeout',
        responseTime,
      };
    }

    return {
      metricId,
      geoLevel,
      available: false,
      error: error.message || 'Unknown error',
      responseTime,
    };
  }
}

/**
 * Test all metric-geography combinations
 */
async function testAllCombinations(
  fetchMetricDataFn: typeof import('../packages/frontend/app/map/config/fetchMetricData').fetchMetricData
): Promise<MetricAvailability> {
  const availability: MetricAvailability = {};
  const allMetrics = Object.keys(METRICS);
  const totalTests = allMetrics.length * GEO_LEVELS.length;
  let completedTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  console.log(`\n🧪 Testing ${totalTests} metric-geography combinations...\n`);
  console.log(`Using data binding layer: fetchMetricData (same as frontend)\n`);

  const results: AvailabilityResult[] = [];

  // Test each combination
  for (const metricId of allMetrics) {
    availability[metricId] = {};

    for (const geoLevel of GEO_LEVELS) {
      process.stdout.write(
        `\rTesting: ${metricId.padEnd(30)} @ ${geoLevel.padEnd(10)} (${completedTests + 1}/${totalTests})...`
      );

      const result = await testMetricGeoAvailability(metricId, geoLevel, fetchMetricDataFn);
      results.push(result);
      
      availability[metricId][geoLevel] = result.available;
      
      completedTests++;
      if (result.available) {
        passedTests++;
      } else {
        failedTests++;
      }

      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`\n\n✅ Testing complete!\n`);
  console.log(`Total tests: ${totalTests}`);
  console.log(`Available: ${passedTests}`);
  console.log(`Unavailable: ${failedTests}\n`);

  // Print summary by metric
  console.log('📊 Availability Summary by Metric:\n');
  for (const metricId of allMetrics) {
    const availableGeos = GEO_LEVELS.filter(geo => availability[metricId][geo]);
    const unavailableGeos = GEO_LEVELS.filter(geo => !availability[metricId][geo]);
    
    console.log(`${metricId}:`);
    console.log(`  ✅ Available: ${availableGeos.join(', ') || 'none'}`);
    if (unavailableGeos.length > 0) {
      console.log(`  ❌ Unavailable: ${unavailableGeos.join(', ')}`);
    }
    console.log('');
  }

  // Print summary by geography
  console.log('\n📊 Availability Summary by Geography:\n');
  for (const geoLevel of GEO_LEVELS) {
    const availableMetrics = allMetrics.filter(metric => availability[metric][geoLevel]);
    const unavailableMetrics = allMetrics.filter(metric => !availability[metric][geoLevel]);
    
    console.log(`${geoLevel}:`);
    console.log(`  ✅ Available: ${availableMetrics.length} metrics`);
    console.log(`  ❌ Unavailable: ${unavailableMetrics.length} metrics`);
    if (unavailableMetrics.length > 0 && unavailableMetrics.length <= 10) {
      console.log(`     ${unavailableMetrics.join(', ')}`);
    }
    console.log('');
  }

  // Print detailed errors for unavailable combinations
  const errors = results.filter(r => !r.available && r.error);
  if (errors.length > 0) {
    console.log('\n❌ Detailed Error Report:\n');
    for (const error of errors.slice(0, 50)) { // Limit to first 50 errors
      console.log(`${error.metricId} @ ${error.geoLevel}: ${error.error}`);
    }
    if (errors.length > 50) {
      console.log(`\n... and ${errors.length - 50} more errors`);
    }
  }

  return availability;
}

/**
 * Generate TypeScript file with availability mapping
 */
function generateAvailabilityFile(availability: MetricAvailability): string {
  const lines: string[] = [
    '/**',
    ' * METRIC-GEOGRAPHY AVAILABILITY MAPPING',
    ' *',
    ' * This file is auto-generated by verify-metric-geography-availability.ts',
    ' * DO NOT EDIT MANUALLY - run the verification script to regenerate.',
    ' *',
    ' * Maps each metric to the geography levels where data is actually available.',
    ' * Used by the metric selector to disable unavailable combinations.',
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

  return lines.join('\n');
}

/**
 * Main execution
 */
async function main() {
  try {
    // Get API URL from environment variable or command line argument
    // MUST be Railway URL - no localhost fallback
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 
                   process.env.API_URL || 
                   process.argv[2];
    
    if (!apiUrl) {
      console.error('❌ Error: API URL is required!');
      console.error('   Set NEXT_PUBLIC_API_URL environment variable or pass as argument:');
      console.error('   NEXT_PUBLIC_API_URL=https://backend-production-ee4d.up.railway.app npx tsx scripts/verify-metric-geography-availability.ts');
      process.exit(1);
    }
    
    if (apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1')) {
      console.error('❌ Error: This script must run against Railway production URL, not localhost!');
      console.error(`   Provided URL: ${apiUrl}`);
      process.exit(1);
    }
    
    // Set the API URL BEFORE importing fetchMetricData (it reads env at module load)
    process.env.NEXT_PUBLIC_API_URL = apiUrl;
    
    console.log('🚀 Starting Metric-Geography Availability Verification\n');
    console.log(`API URL: ${apiUrl}`);
    console.log(`Using ONLY fetchMetricData (data binding layer)\n`);
    
    // Import fetchMetricData AFTER setting API URL (it reads env at module load)
    const { fetchMetricData } = await import('../packages/frontend/app/map/config/fetchMetricData');
    
    // Test a few combinations first to verify connectivity
    console.log('🔍 Testing connectivity with sample requests...\n');
    const testMetrics = ['home_value', 'listing_price', 'population'];
    const testGeos: GeoLevel[] = ['state', 'metro'];
    
    for (const metricId of testMetrics) {
      for (const geoLevel of testGeos) {
        const result = await testMetricGeoAvailability(metricId, geoLevel, fetchMetricData);
        const status = result.available ? '✅' : '❌';
        console.log(`${status} ${metricId} @ ${geoLevel}: ${result.dataCount || 0} records${result.error ? ` (${result.error})` : ''}`);
      }
    }
    console.log('\n');
    
    // Test all combinations using ONLY the data binding layer
    const availability = await testAllCombinations(fetchMetricData);
    
    // Generate availability mapping file
    const availabilityFile = generateAvailabilityFile(availability);
    
    // Write to file
    const fs = await import('fs/promises');
    const path = await import('path');
    const outputPath = path.join(__dirname, '../packages/frontend/app/map/config/metric-availability.ts');
    
    await fs.writeFile(outputPath, availabilityFile, 'utf-8');
    console.log(`\n✅ Generated availability mapping file: ${outputPath}\n`);
    
    // Also save results as JSON for reference
    const jsonPath = path.join(__dirname, '../metric-geography-availability-results.json');
    await fs.writeFile(jsonPath, JSON.stringify(availability, null, 2), 'utf-8');
    console.log(`✅ Saved results JSON: ${jsonPath}\n`);
    
    console.log('✨ Verification complete!\n');
    
  } catch (error: any) {
    console.error('\n❌ Error during verification:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { testMetricGeoAvailability, testAllCombinations };
