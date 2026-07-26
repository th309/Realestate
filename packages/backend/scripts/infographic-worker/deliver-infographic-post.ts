// packages/backend/scripts/infographic-worker/deliver-infographic-post.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClaimableRun } from './resolve-claimable-run';

/** Same bucket the post-image renderer and metro-hero services use. */
export const INFOGRAPHIC_BUCKET = 'content-pipeline';

async function resolveBrandId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client
    .from('brands')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('no brand row found — generate a feed post first');
  return data.id as string;
}

/**
 * Upload the generated PNG and drop a draft post into the normal review feed.
 *
 * media_refs follows the frozen contract: `storage_path` only (never `path`,
 * never a persisted signed URL) — the posts API signs on read.
 */
export async function deliverInfographicPost(
  client: SupabaseClient,
  run: ClaimableRun,
  png: Buffer,
): Promise<string> {
  const storagePath = `infographics/${run.id}/0.png`;
  const { error: uploadErr } = await client.storage
    .from(INFOGRAPHIC_BUCKET)
    .upload(storagePath, png, { contentType: 'image/png', upsert: true });
  if (uploadErr) throw uploadErr;

  const brandId = await resolveBrandId(client);
  const now = new Date().toISOString();
  const { data: post, error: postErr } = await client
    .from('posts')
    .insert({
      brand_id: brandId,
      platform: 'linkedin',
      post_type: 'infographic',
      copy: {
        title: `${run.topic.title} - ${run.task.label}`,
        hook: run.task.label,
      },
      media_refs: [
        {
          kind: 'image',
          bucket: INFOGRAPHIC_BUCKET,
          storage_path: storagePath,
          order: 0,
        },
      ],
      status: 'pending_review',
      source: 'ai_generated',
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single();
  if (postErr) throw postErr;
  return post.id as string;
}
