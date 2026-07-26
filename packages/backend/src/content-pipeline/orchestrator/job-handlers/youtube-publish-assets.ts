// packages/backend/src/content-pipeline/orchestrator/job-handlers/youtube-publish-assets.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeFileSync } from 'fs';

/**
 * Pull a `supabase://bucket/path` asset down to a local temp file, which is
 * what the YouTube publishers upload from.
 */
export async function downloadVideoToTempFile(
  client: SupabaseClient,
  supabaseUrl: string,
): Promise<string> {
  const match = supabaseUrl.match(/^supabase:\/\/([^/]+)\/(.+)$/);
  if (!match) throw new Error(`invalid supabase url: ${supabaseUrl}`);
  const [, bucket, path] = match;
  const { data } = await client.storage.from(bucket).download(path);
  if (!data) throw new Error(`no data downloaded from ${supabaseUrl}`);
  const localPath = join(tmpdir(), `pub-${Date.now()}.mp4`);
  writeFileSync(localPath, Buffer.from(await data.arrayBuffer()));
  return localPath;
}
