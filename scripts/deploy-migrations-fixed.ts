
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Hardcoded for reliability in this fix script, based on .env.local
const SUPABASE_URL = 'https://pysflbhpnqwoczyuaaif.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5c2ZsYmhwbnF3b2N6eXVhYWlmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjYxMzczNSwiZXhwIjoyMDc4MTg5NzM1fQ.8KBZl3TrOXaA4czqaRd65KC_MXr4hI3jTnQdr_l7d3I';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function executeSql(query: string) {
    const { error } = await supabase.rpc('exec_sql', { query });
    if (error) {
        throw new Error(`RPC exec_sql failed: ${error.message} (Hint: make sure exec_sql function exists)`);
    }
}

async function ensureMigrationsTable() {
    const sql = `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ DEFAULT NOW(),
      success BOOLEAN DEFAULT TRUE,
      error TEXT
    );
  `;
    await executeSql(sql);
}

async function getExecutedMigrations() {
    const { data, error } = await supabase.from('schema_migrations').select('name, success');
    if (error) throw error;
    // valid if success is true or null (legacy?) - assuming success=true required
    return new Set(data?.filter(r => r.success).map(r => r.name) || []);
}

async function recordMigration(name: string, success: boolean, errorMsg?: string) {
    const { error } = await supabase.from('schema_migrations').upsert({
        name,
        executed_at: new Date().toISOString(),
        success,
        error: errorMsg || null
    }, { onConflict: 'name' });

    if (error) console.error('Failed to record migration status:', error);
}

async function main() {
    console.log('🚀 Starting migration deployment...');

    try {
        await ensureMigrationsTable();
        const executed = await getExecutedMigrations();
        console.log(`📋 Found ${executed.size} already executed migrations.`);

        const migrationsDir = path.join(__dirname, 'migrations');
        const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

        let count = 0;
        for (const file of files) {
            if (executed.has(file)) {
                continue; // Skip
            }

            console.log(`▶️  Running migration: ${file}`);
            const filePath = path.join(migrationsDir, file);
            const sql = fs.readFileSync(filePath, 'utf8');

            try {
                await executeSql(sql);
                await recordMigration(file, true);
                console.log(`✅ Success: ${file}`);
                count++;
            } catch (err: any) {
                console.error(`❌ Failed: ${file}`);
                console.error(err.message);
                await recordMigration(file, false, err.message);
                process.exit(1);
            }
        }

        if (count === 0) {
            console.log('✨ No new migrations to run.');
        } else {
            console.log(`🎉 Successfully ran ${count} migrations.`);
        }

    } catch (err: any) {
        console.error('Fatal error:', err);
        process.exit(1);
    }
}

main();
