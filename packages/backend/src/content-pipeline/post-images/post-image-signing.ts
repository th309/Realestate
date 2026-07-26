// packages/backend/src/content-pipeline/post-images/post-image-signing.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PostMediaRef } from '../posts/post.types';

/** Signed-URL TTL for post images shown in the admin feed UI. */
export const POST_IMAGE_SIGNED_URL_TTL_SECONDS = 3600; // 1 hour

/** A media ref enriched with a short-lived signed URL for the client. */
export type SignedMediaRef = PostMediaRef & { url?: string };

function isImageRef(
  ref: PostMediaRef,
): ref is PostMediaRef & { bucket: string; storage_path: string } {
  return (
    ref?.kind === 'image' &&
    typeof (ref as { bucket?: unknown }).bucket === 'string' &&
    typeof (ref as { storage_path?: unknown }).storage_path === 'string'
  );
}

/**
 * Mint 1-hour signed URLs for every stored image ref (media_refs store PATHS in
 * `storage_path`, not URLs, because signed URLs expire). Non-image refs and refs
 * that fail to sign pass through without a url rather than failing the whole
 * list/get. `storage_path` matches the publisher's frozen PostMediaRef contract.
 */
export async function signPostMediaRefs(
  client: SupabaseClient,
  mediaRefs: PostMediaRef[] | undefined,
): Promise<SignedMediaRef[]> {
  if (!Array.isArray(mediaRefs) || mediaRefs.length === 0) return [];
  return Promise.all(
    mediaRefs.map(async (ref): Promise<SignedMediaRef> => {
      if (!isImageRef(ref)) return ref;
      try {
        const { data } = await client.storage
          .from(ref.bucket)
          .createSignedUrl(ref.storage_path, POST_IMAGE_SIGNED_URL_TTL_SECONDS);
        return data?.signedUrl ? { ...ref, url: data.signedUrl } : ref;
      } catch {
        return ref;
      }
    }),
  );
}
