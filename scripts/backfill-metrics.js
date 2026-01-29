const http = require('http');
const https = require('https');
const url = require('url');

// Default to local, but support override
const API_URL = process.env.API_URL || 'http://localhost:3001';
const parsedUrl = url.parse(API_URL);
const client = parsedUrl.protocol === 'https:' ? https : http;
const API_PORT = parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80);

// Default years or override
const YEARS = process.env.YEAR ? [parseInt(process.env.YEAR)] : [2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015];

const ENDPOINTS = [
    // 1. Inventory Surplus
    { path: '/api/metrics/inventory-surplus/calculate/national', name: 'Inventory Surplus (National)' },
    { path: '/api/metrics/inventory-surplus/calculate/states', name: 'Inventory Surplus (States)' },
    { path: '/api/metrics/inventory-surplus/calculate/metros', name: 'Inventory Surplus (Metros)' },

    // 2. 5-Year Growth
    { path: '/api/metrics/calculate-5yr-growth/national', name: '5-Year Growth (National)' },
    { path: '/api/metrics/calculate-5yr-growth/states', name: '5-Year Growth (States)' },
    { path: '/api/metrics/calculate-5yr-growth/metros', name: '5-Year Growth (Metros)' },

    // 3. Investment Metrics
    { path: '/api/metrics/calculate-investment-metrics', name: 'Investment Metrics (All Geos)' },
];

function postRequest(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: parsedUrl.hostname,
            port: API_PORT,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const req = client.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        resolve(data);
                    }
                } else {
                    // Attempt to parse error
                    try {
                        const errData = JSON.parse(data);
                        reject(new Error(`HTTP ${res.statusCode}: ${errData.error || data}`));
                    } catch {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.end();
    });
}

async function runBackfill() {
    console.log(`Starting Historical Backfill against ${API_URL}...`);
    console.log(`Years: ${YEARS.join(', ')}`);

    for (const year of YEARS) {
        console.log(`\n=== Processing Year: ${year} ===`);
        for (const ep of ENDPOINTS) {
            const fullPath = `${ep.path}?year=${year}`;
            process.stdout.write(`[${ep.name}] Requesting... `);
            try {
                const start = Date.now();
                const result = await postRequest(fullPath);
                const duration = ((Date.now() - start) / 1000).toFixed(1);

                let processed = result.processed || (result.results ? Object.values(result.results).reduce((a, b) => a + (b.processed || 0), 0) : 0);
                let stored = result.stored || (result.results ? Object.values(result.results).reduce((a, b) => a + (b.stored || 0), 0) : 0);

                // Adjust for specific nested structure if needed
                if (result.totals) {
                    processed = result.totals.processed;
                    stored = result.totals.stored;
                }

                console.log(`✅ Success (${duration}s): Processed=${processed}, Stored=${stored}`);
            } catch (err) {
                console.log('');
                console.error(`❌ Failed: ${err.message}`);
            }
        }
    }
}

runBackfill();
