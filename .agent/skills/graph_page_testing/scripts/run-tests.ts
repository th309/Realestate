
import fetch from 'node-fetch';

const API_URL = process.env.API_URL || 'https://backend-production-ee4d.up.railway.app';

interface TestResult {
    name: string;
    passed: boolean;
    message: string;
    duration?: number;
}

const results: TestResult[] = [];

async function runTimeSeriesTest(name: string, metric: string, geoLevel: string, regionId: string) {
    const start = Date.now();
    // Using limit to check basic response, not full history
    const url = `${API_URL}/api/timeseries/${metric}/${geoLevel}/${encodeURIComponent(regionId)}?limit=100`;

    try {
        const response = await fetch(url);
        const duration = Date.now() - start;

        if (!response.ok) {
            // Log status text
            results.push({
                name,
                passed: false,
                message: `HTTP ${response.status}: ${response.statusText}`,
                duration
            });
            return;
        }

        // Check if response has content
        const data = await response.json();

        // Check if empty array
        if (!Array.isArray(data) || data.length === 0) {
            // Some endpoints might return empty if no data for that specific region+metric
            // But "success" implies it handled the request.
            // If it's a 200 OK but empty array, it means no data found.
            // We'll mark it as failed if we EXPECT data.
            results.push({
                name,
                passed: false,
                message: `No data returned (empty array)`,
                duration
            });
            return;
        }

        // Validate structure of first item
        const point = data[0];
        if (!point.date || typeof point.value !== 'number') {
            results.push({
                name,
                passed: false,
                message: `Invalid data format: ${JSON.stringify(point)}`,
                duration
            });
            return;
        }

        results.push({
            name,
            passed: true,
            message: `Got ${data.length} points`,
            duration
        });

    } catch (error: any) {
        results.push({
            name,
            passed: false,
            message: `Exception: ${error.message}`,
            duration: Date.now() - start
        });
    }
}

async function main() {
    console.log('Starting Graph Page Tests (Aligned with Sidebar)...');

    // Test 1: National Listing Price (Valid, supported by realtor)
    await runTimeSeriesTest('National Listing Price', 'listing_price', 'national', 'United States');

    // Test 2: State Home Value (Texas) - Supported
    await runTimeSeriesTest('State Home Value (TX)', 'home_value', 'state', 'Texas');

    // Test 3: Metro Home Value (Austin) - Supported
    // Region ID "Austin-Round Rock, TX"
    await runTimeSeriesTest('Metro Home Value (Austin)', 'home_value', 'metro', 'Austin-Round Rock, TX');

    // Test 4: County Home Value (Travis County, TX) - Supported
    await runTimeSeriesTest('County Home Value (Travis)', 'home_value', 'county', 'Travis County, TX');

    // Test 5: Zip Home Value (78701) - Supported
    await runTimeSeriesTest('Zip Home Value (78701)', 'home_value', 'zip', '78701');

    // Test 6: Days on Market (Metro) - Supported
    await runTimeSeriesTest('Metro DOM (Austin)', 'days_on_market', 'metro', 'Austin-Round Rock, TX');

    // Test 7: Cap Rate (Metro) - Calculated Metric
    await runTimeSeriesTest('Metro Cap Rate (Austin)', 'cap_rate', 'metro', 'Austin-Round Rock, TX');

    // Test 8: Investor Edge Score (Metro) - Score Metric
    // Metric ID: investoredge_score
    await runTimeSeriesTest('Metro Inv Edge Score', 'investoredge_score', 'metro', 'Austin-Round Rock, TX');

    console.log('\n--- Test Report ---');
    let passed = 0;
    for (const res of results) {
        const symbol = res.passed ? '✓' : '✗';
        console.log(`${symbol} ${res.name}: ${res.message} (${res.duration}ms)`);
        if (res.passed) passed++;
    }

    console.log(`\nSummary: ${passed}/${results.length} passed.`);

    if (passed < results.length) {
        process.exit(1);
    }
}

main().catch(console.error);
