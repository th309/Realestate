const path = require('path');
const { config } = require('dotenv');

// Load from packages/backend/.env
const envPath = path.join(__dirname, '../packages/backend/.env');
const result = config({ path: envPath });

if (result.error) {
    console.log('Error loading .env:', result.error.message);
} else {
    console.log('Loaded .env');
}

const url = process.env.SUPABASE_URL;
const dbUrl = process.env.DATABASE_URL;
const directUrl = process.env.DIRECT_URL;

console.log('SUPABASE_URL:', url);
// Mask password in DB URLs
function mask(s) {
    if (!s) return s;
    return s.replace(/:[^:@]+@/, ':****@');
}
console.log('DATABASE_URL:', mask(dbUrl));
console.log('DIRECT_URL:', mask(directUrl));
