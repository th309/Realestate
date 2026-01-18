
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
    ssl: { rejectUnauthorized: false } // Required for some pooler setups if certs are tricky
};

async function main() {
    console.log('🚀 Starting migration deployment (Direct PG)...');

    const client = new Client(CONFIG);

    try {
        await client.connect();
        console.log('✅ Connected to database.');

        // 1. Ensure migrations table exists
        await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ DEFAULT NOW(),
        success BOOLEAN DEFAULT TRUE,
        error TEXT
      );
    `);

        // 2. Get executed migrations
        const res = await client.query('SELECT name FROM public.schema_migrations WHERE success = true');
        const executed = new Set(res.rows.map(r => r.name));
        console.log(`📋 Found ${executed.size} executed migrations.`);

        // 3. Get all local migration files
        const migrationsDir = path.join(__dirname, 'migrations');
        const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

        let count = 0;
        for (const file of files) {
            if (executed.has(file)) {
                continue;
            }

            console.log(`▶️  Running migration: ${file}`);
            const filePath = path.join(migrationsDir, file);
            const sql = fs.readFileSync(filePath, 'utf8');

            try {
                await client.query('BEGIN');
                await client.query(sql);

                // Record success
                await client.query(
                    'INSERT INTO public.schema_migrations (name, success, executed_at) VALUES ($1, $2, NOW()) ON CONFLICT (name) DO UPDATE SET success = $2, executed_at = NOW(), error = NULL',
                    [file, true]
                );

                await client.query('COMMIT');
                console.log(`✅ Success: ${file}`);
                count++;
            } catch (err: any) {
                await client.query('ROLLBACK');
                console.error(`❌ Failed: ${file}`);
                console.error(err.message);

                // Record failure
                try {
                    await client.query(
                        'INSERT INTO public.schema_migrations (name, success, error, executed_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (name) DO UPDATE SET success = $2, error = $3, executed_at = NOW()',
                        [file, false, err.message]
                    );
                } catch (recErr) {
                    console.error('Failed to record error state:', recErr);
                }

                process.exit(1);
            }
        }

        if (count === 0) {
            console.log('✨ All migrations are up to date.');
        } else {
            console.log(`🎉 Successfully ran ${count} migrations.`);
        }

    } catch (err) {
        console.error('Fatal error:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

main();
