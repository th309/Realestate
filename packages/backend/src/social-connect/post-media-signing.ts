import type { SupabaseClient } from '@supabase/supabase-js';
import type { PostMediaRef } from '../content-pipeline/posts/post.types';

/**
 * TTL for the signed image URLs handed to Late at publish time. ≥1h so Late has
 * ample time to fetch the asset server-side. URLs are signed FRESH on every
 * publish attempt (never cached), so a crash-recovery re-attempt minutes later
 * never carries an expired link. Mirrors the video pipeline's 3600s signing
 * (see content-pipeline/asset-signing.ts).
 */
export const POST_IMAGE_SIGNED_URL_TTL_SEC = 3600;

/**
 * Resolve a post's image `media_refs` to signed, publicly-fetchable https URLs
 * for the Late publish call, ordered by the ref `order` field so a carousel
 * keeps its authored sequence.
 *
 * Two ref shapes are accepted:
 *   - Storage-backed (the render pipeline's frozen shape):
 *       { kind:'image', bucket, path, width, height, order }
 *     → a fresh Supabase Storage signed URL (paths are private, never public).
 *   - Already-public: { kind:'image', url:'https://…' } → passed through as-is.
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
 * be a silent text-only downgrade.
 */
async function signRef(
  client: SupabaseClient,
  ref: PostMediaRef,
): Promise<string | null> {
  const bucket = typeof ref.bucket === 'string' ? ref.bucket : undefined;
  const path = typeof ref.path === 'string' ? ref.path : undefined;

  if (bucket && path) {
    const { data, error } = await client.storage
      .from(bucket)
      .createSignedUrl(path, POST_IMAGE_SIGNED_URL_TTL_SEC);
    if (error || !data?.signedUrl) {
      throw new Error(
        `failed to sign post image ${bucket}/${path}: ${
          error?.message ?? 'no signed url returned'
        }`,
      );
    }
    return data.signedUrl;
  }

  // Already-public asset (e.g. an externally hosted image): pass through.
  if (typeof ref.url === 'string' && ref.url.startsWith('https://')) {
    return ref.url;
  }

  // No storage location and no https url — nothing we can safely attach.
  return null;
}
