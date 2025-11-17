/**
 * Grant Sequence Permissions
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: join(__dirname, '../web/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function run() {
  const sql = readFileSync('scripts/migrations/012-grant-sequence-permissions.sql', 'utf-8');
  const { error } = await supabase.rpc('exec_sql', { query: sql });
  
  if (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } else {
    console.log('✅ Sequence permissions granted!');
  }
}

run();

