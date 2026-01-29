const http = require('http');

const url = require('url');

const API_URL = process.env.API_URL || 'http://localhost:3001';
const parsedUrl = url.parse(API_URL);
const API_HOST = parsedUrl.hostname;
const API_PORT = parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80);
const YEARS = process.env.YEAR ? [parseInt(process.env.YEAR)] : [2024, 2023, 2022, 2021, 2020, 2019, 2018];

const ENDPOINTS = [
    { path: '/api/metrics/inventory-surplus/calculate/national', name: 'Inventory Surplus (National)' },
    { path: '/api/metrics/inventory-surplus/calculate/states', name: 'Inventory Surplus (States)' },
    { path: '/api/metrics/inventory-surplus/calculate/metros', name: 'Inventory Surplus (Metros)' },
    { path: '/api/metrics/calculate-5yr-growth/national', name: '5-Year Growth (National)' },
    { path: '/api/metrics/calculate-5yr-growth/states', name: '5-Year Growth (States)' },
    { path: '/api/metrics/calculate-5yr-growth/metros', name: '5-Year Growth (Metros)' },
];

function postRequest(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: API_HOST,
            port: API_PORT,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        };

        const req = http.request(options, (res) => {
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
                    reject(new Error(`HTTP ${res.statusCode}: ${data}`));
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
    console.log('Starting Historical Backfill...');

    for (const year of YEARS) {
        console.log(`\n=== Processing Year: ${year} ===`);
        for (const ep of ENDPOINTS) {
            const fullPath = `${ep.path}?year=${year}`;
            process.stdout.write(`[${ep.name}] Requesting... `);
            try {
                const start = Date.now();
                const result = await postRequest(fullPath);
                const duration = (Date.now() - start) / 1000;
                console.log(`✅ Success (${duration.toFixed(1)}s): Processed=${result.processed || result.results?.processed || 0}, Stored=${result.stored || result.results?.stored || 0}`);
            } catch (err) {
                console.log('');
                console.error(`❌ Failed: ${err.message.substring(0, 100)}...`);
            }
        }
    }
}

runBackfill();
