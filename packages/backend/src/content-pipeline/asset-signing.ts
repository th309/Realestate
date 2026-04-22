import { SupabaseClient } from '@supabase/supabase-js';

export type SignedAssetKind = 'video_master' | 'audio';

/**
 * Look up the most recent asset of the given kind for a run and return a
 * short-lived signed URL. Returns null if the asset is missing.
 * Extracted from ContentPipelineService to keep that file under the file-size
 * limit; it has no orchestrator dependencies so it lives fine on its own.
 */
export async function getAssetSignedUrl(
  client: SupabaseClient,
  runId: string,
  kind: SignedAssetKind,
): Promise<{ url: string; kind: string } | null> {
  const { data: assets, error } = await client
    .from('content_assets')
    .select('kind, storage_url')
    .eq('run_id', runId)
    .eq('kind', kind)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  const asset = assets?.[0];
  if (!asset?.storage_url) return null;

  const match = String(asset.storage_url).match(/^supabase:\/\/([^/]+)\/(.+)$/);
  if (!match) return null;
  const [, bucket, path] = match;

  const { data, error: signError } = await client.storage
    .from(bucket)
    .createSignedUrl(path, 3600);
  if (signError || !data) throw signError ?? new Error('signUrl failed');
  return { url: data.signedUrl, kind: asset.kind as string };
}
