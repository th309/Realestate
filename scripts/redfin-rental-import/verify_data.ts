
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../packages/backend/.env') });

const dbConfig = {
    host: 'aws-1-us-east-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.pysflbhpnqwoczyuaaif',
    password: 'IHatedoingpt12',
    ssl: { rejectUnauthorized: false }
};

const client = new Client(dbConfig);

async function checkData() {
    await client.connect();
    const tables = ['redfin_rental_national', 'redfin_rental_metro', 'redfin_rental_city', 'redfin_rental_zip', 'redfin_rental_county'];

    for (const t of tables) {
        const res = await client.query(`SELECT count(*) as cnt FROM ${t}`);
        console.log(`${t}: ${res.rows[0].cnt} rows`);

        if (res.rows[0].cnt > 0) {
            const sample = await client.query(`SELECT * FROM ${t} LIMIT 1`);
            console.log('Sample:', sample.rows[0]);
        }
    }
    await client.end();
}

checkData().catch(console.error);
