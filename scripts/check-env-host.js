const path = require('path');
const { config } = require('dotenv');

// Load from packages/backend/.env
const envPath = path.join(__dirname, '../packages/backend/.env');
config({ path: envPath });

const dbUrl = process.env.DATABASE_URL || '';
const directUrl = process.env.DIRECT_URL || '';

function getHost(url) {
    try {
        if (!url) return 'undefined';
        const match = url.match(/@([^:]+):/);
        return match ? match[1] : 'no-host-found';
    } catch (e) {
        return 'error-parsing';
    }
}

function getPort(url) {
    try {
        if (!url) return 'undefined';
        const match = url.match(/:(\d+)\//);
        return match ? match[1] : 'no-port-found';
    } catch (e) {
        return 'error-parsing';
    }
}

console.log('DATABASE_URL Host:', getHost(dbUrl));
console.log('DATABASE_URL Port:', getPort(dbUrl));
console.log('DIRECT_URL Host:', getHost(directUrl));
console.log('DIRECT_URL Port:', getPort(directUrl));
