/**
 * Database Client and SQL Execution
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as readline from 'readline';
import { getSupabaseKey, isUsingServiceRoleKey } from './env-loader';

/**
 * Get Supabase client with admin access
 */
export function getSupabaseClient(projectRef: string, _dbPassword: string): SupabaseClient {
  const supabaseUrl = `https://${projectRef}.supabase.co`;
  const supabaseKey = getSupabaseKey();

  if (!supabaseKey) {
    throw new Error(
      'Missing Supabase key in environment.\n' +
      'Please set SUPABASE_SERVICE_ROLE_KEY (preferred) or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local\n' +
      'Service role key is required for INSERT operations via exec_sql RPC'
    );
  }

  if (!isUsingServiceRoleKey()) {
    console.warn('Warning: Using anon key instead of service role key.');
    console.warn('   This may cause permission errors. Use SUPABASE_SERVICE_ROLE_KEY for admin operations.');
  } else {
    console.log('Using service role key for admin operations');
  }

  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Prompt for password securely
 */
export function promptPassword(): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question('Enter Supabase database password: ', (password) => {
      rl.close();
      resolve(password);
    });
  });
}

/**
 * Execute SQL via Supabase RPC
 */
export async function executeSQL(
  supabase: SupabaseClient,
  query: string
): Promise<{ error: any }> {
  const { error: rpcError } = await supabase.rpc('exec_sql', { query });

  if (!rpcError) {
    return { error: null };
  }

  const errorMsg = rpcError.message || rpcError.toString() || JSON.stringify(rpcError);
  console.error('RPC exec_sql error:', errorMsg);
  console.error('   Query preview:', query.substring(0, 200) + '...');

  return { error: rpcError };
}

/**
 * Get or prompt for password based on available credentials
 */
export async function resolvePassword(dbPassword?: string): Promise<string> {
  const supabaseKey = getSupabaseKey();

  if (dbPassword) {
    return dbPassword;
  }

  if (supabaseKey) {
    return '';
  }

  return promptPassword();
}
