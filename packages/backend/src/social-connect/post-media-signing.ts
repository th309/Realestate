import type { SupabaseClient } from '@supabase/supabase-js';
import type { PostMediaRef } from '../content-pipeline/posts/post.types';
import { signStoragePath } from '../content-pipeline/asset-signing';

/**
 * TTL for the signed image URLs handed to Late at publish time. ≥1h so Late has
 * ample time to fetch the asset server-side. URLs are signed FRESH on every
 * publish attempt (never cached), so a crash-recovery re-attempt minutes later
 * never carries an expired link. Mirrors the video pipeline's 3600s signing
 * (content-pipeline/asset-signing.ts).
 */
export const POST_IMAGE_SIGNED_URL_TTL_SEC = 3600;

/** Rendered post images live in this bucket unless the ref says otherwise. */
export const POST_IMAGE_DEFAULT_BUCKET = 'content-pipeline';

/**
 * Resolve a post's image `media_refs` to signed, publicly-fetchable https URLs
 * for the Late publish call, ordered by the ref `order` field so a carousel
 * keeps its authored sequence.
 *
 * Two ref shapes are accepted:
 *   - Storage-backed (the render pipeline's frozen shape):
 *       { kind:'image', bucket:'content-pipeline', storage_path:'posts/<id>/1.png',
 *         width, height, order }
 *     → a fresh Supabase Storage signed URL (paths are private, never public).
 *       `bucket` defaults to 'content-pipeline' when omitted.
 *   - Legacy already-public: { kind:'image', url:'https://…' } → passed through.
 *     (Rendered refs carry no `url`; this is only for older/manual refs.)
 *
 * Honest-failure contract: a storage-backed ref that FAILS to sign THROWS, so
 * the publish fails visibly (→ Needs-attention) rather than silently dropping
 * the image and posting text-only. Non-image refs and refs with no resolvable
 * location are dropped; a post with zero resolvable images publishes text-only
 * exactly as before (no regression).
 */
export async function resolvePostMediaUrls(
  client: SupabaseClient,
  refs: PostMediaRef[] | null,
): Promise<string[]> {
  const images = (refs ?? [])
    .filter((ref) => ref.kind === 'image')
    .map((ref, index) => ({
      ref,
      order: typeof ref.order === 'number' ? ref.order : index,
    }))
    .sort((a, b) => a.order - b.order)
    .map((entry) => entry.ref);

  const urls: string[] = [];
  for (const ref of images) {
    const url = await signRef(client, ref);
    if (url) urls.push(url);
  }
  return urls;
}

/**
 * Resolve one image ref to a signed/public https URL, or null when it carries
 * no resolvable location. Throws when a storage-backed ref cannot be signed —
 * that is an image we were meant to attach but couldn't, and dropping it would
 * be a silent text-only downgrade. Reuses the shared `signStoragePath` signer.
 */
async function signRef(
  client: SupabaseClient,
  ref: PostMediaRef,
): Promise<string | null> {
  const storagePath =
    typeof ref.storage_path === 'string' ? ref.storage_path : undefined;

  if (storagePath) {
    const bucket =
      typeof ref.bucket === 'string' ? ref.bucket : POST_IMAGE_DEFAULT_BUCKET;
    try {
      return await signStoragePath(
        client,
        bucket,
        storagePath,
        POST_IMAGE_SIGNED_URL_TTL_SEC,
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(
        `failed to sign post image ${bucket}/${storagePath}: ${reason}`,
      );
    }
  }

  // Legacy already-public asset (rendered refs carry no url): pass through.
  if (typeof ref.url === 'string' && ref.url.startsWith('https://')) {
    return ref.url;
  }

  // No storage location and no https url — nothing we can safely attach.
  return null;
}
