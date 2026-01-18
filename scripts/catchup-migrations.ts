
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Config - using the known working connection details
const CONFIG = {
    host: 'aws-1-us-east-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.pysflbhpnqwoczyuaaif',
    password: 'IHatedoingpt12',
    ssl: { rejectUnauthorized: false }
};

async function main() {
    console.log('🚀 Starting migration catch-up...');

    const client = new Client(CONFIG);

    try {
        await client.connect();
        console.log('✅ Connected to database.');

        // 1. Get all local migration files
        const migrationsDir = path.join(__dirname, 'migrations');
        const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

        console.log(`Found ${files.length} local migration files.`);

        // 2. Mark files as executed if they are <= 050
        const cutoff = '050';
        let markedCount = 0;

        for (const file of files) {
            const prefix = file.substring(0, 3);
            if (prefix <= cutoff) {
                // Check if already marked
                const res = await client.query('SELECT 1 FROM public.schema_migrations WHERE name = $1', [file]);
                if (res.rowCount === 0) {
                    console.log(`📝 Marking ${file} as legacy/already-executed...`);
                    await client.query(
                        'INSERT INTO public.schema_migrations (name, success, executed_at) VALUES ($1, $2, NOW())',
                        [file, true]
                    );
                    markedCount++;
                }
            }
        }

        console.log(`See? We updated usage. Marked ${markedCount} migrations as manually resolved.`);

    } catch (err) {
        console.error('Fatal error:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

main();
