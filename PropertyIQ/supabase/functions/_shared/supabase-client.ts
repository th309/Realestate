// Supabase Client for Edge Functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// Get environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  throw new Error('Missing required Supabase environment variables');
}

// Create clients
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export const supabaseServiceClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Database helper functions
export async function executeQuery<T = any>(
  query: string,
  params: any[] = []
): Promise<T[]> {
  const { data, error } = await supabaseServiceClient.rpc('execute_sql', {
    query,
    params,
  });

  if (error) {
    console.error('Database query error:', error);
    throw new Error(`Database query failed: ${error.message}`);
  }

  return data as T[];
}

// Function to call the normalize_location database function
export async function normalizeLocation(
  inputText: string,
  contextState?: string
): Promise<{
  geoid: string;
  confidence: number;
  match_type: string;
}> {
  const { data, error } = await supabaseServiceClient.rpc('normalize_location', {
    input_text: inputText,
    context_state: contextState || null,
  });

  if (error) {
    console.error('Normalization error:', error);
    throw new Error(`Location normalization failed: ${error.message}`);
  }

  return data;
}

// Storage helper functions
export async function getFileFromStorage(
  bucket: string,
  path: string
): Promise<ArrayBuffer> {
  const { data, error } = await supabaseServiceClient.storage
    .from(bucket)
    .download(path);

  if (error) {
    console.error('Storage download error:', error);
    throw new Error(`Failed to download file: ${error.message}`);
  }

  return await data.arrayBuffer();
}

export async function uploadToStorage(
  bucket: string,
  path: string,
  file: ArrayBuffer | Blob,
  contentType?: string
): Promise<string> {
  const { data, error } = await supabaseServiceClient.storage
    .from(bucket)
    .upload(path, file, {
      contentType: contentType || 'application/octet-stream',
      upsert: true,
    });

  if (error) {
    console.error('Storage upload error:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  return data.path;
}

// Batch insert helper
export async function batchInsert<T extends Record<string, any>>(
  table: string,
  records: T[],
  batchSize: number = 1000
): Promise<number> {
  let totalInserted = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    
    const { error } = await supabaseServiceClient
      .from(table)
      .insert(batch);

    if (error) {
      console.error(`Batch insert error at index ${i}:`, error);
      throw new Error(`Batch insert failed: ${error.message}`);
    }

    totalInserted += batch.length;
  }

  return totalInserted;
}

// Transaction helper (using RPC function)
export async function runTransaction<T = any>(
  operations: Array<{
    query: string;
    params?: any[];
  }>
): Promise<T> {
  const { data, error } = await supabaseServiceClient.rpc('run_transaction', {
    operations,
  });

  if (error) {
    console.error('Transaction error:', error);
    throw new Error(`Transaction failed: ${error.message}`);
  }

  return data as T;
}
