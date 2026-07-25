import { SupabaseClient } from '@supabase/supabase-js';

export type SignedAssetKind = 'video_master' | 'audio';

/** Default signed-URL lifetime — long enough for a downstream fetch, short
 *  enough that a leaked link expires quickly. */
export const DEFAULT_SIGNED_URL_TTL_SEC = 3600;

/**
 * Sign a private Supabase Storage object (bucket + path) to a short-lived URL.
 * The shared low-level signing primitive: callers that already hold a bucket
 * and path (e.g. the social publisher's image media_refs) use this directly;
 * {@link getAssetSignedUrl} layers the content_assets lookup + `supabase://`
 * URI parsing on top. Throws on failure so a missing/unsignable object never
 * silently yields no URL.
 */
export async function signStoragePath(
  client: SupabaseClient,
  bucket: string,
  path: string,
  expiresInSec: number = DEFAULT_SIGNED_URL_TTL_SEC,
): Promise<string> {
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSec);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? 'signUrl failed');
  }
  return data.signedUrl;
}

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

  const url = await signStoragePath(client, bucket, path);
  return { url, kind: asset.kind as string };
}
