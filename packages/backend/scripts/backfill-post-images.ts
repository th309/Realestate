// One-off, idempotent backfill: render images for pending_review posts that have
// no media_refs yet (drafts generated before the render wiring). Image-capable
// post types only — video_script is a suggestion and renders nothing. Best-effort
// per post (a render/upload failure leaves the draft untouched). Safe to re-run:
// it only touches posts whose media_refs are still empty.
//
// Run: node -r ts-node/register/transpile-only packages/backend/scripts/backfill-post-images.ts

import { config as loadEnv } from 'dotenv';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';
import { PuppeteerPostImageRenderer } from '../src/content-pipeline/post-images/post-image-renderer';
import { PostImageRenderService } from '../src/content-pipeline/post-images/post-image-render.service';
import type { PostRow } from '../src/content-pipeline/posts/post.types';

loadEnv({ path: join(__dirname, '..', '.env') });

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY not set');

  const client = createClient(url, key);
  const supabase = { getClient: () => client } as never;
  const renderer = new PuppeteerPostImageRenderer();
  const renderService = new PostImageRenderService(supabase, renderer);

  const { data, error } = await client
    .from('posts')
    .select('*')
    .eq('status', 'pending_review')
    .limit(500);
  if (error) throw error;

  const targets = ((data ?? []) as PostRow[]).filter(
    (p) => (p.media_refs ?? []).length === 0 && p.post_type !== 'video_script',
  );

  let rendered = 0;
  let skipped = 0;
  let failed = 0;
  try {
    for (const post of targets) {
      try {
        const refs = await renderService.renderForPost(post);
        if (refs.length > 0) {
          const { error: upErr } = await client
            .from('posts')
            .update({ media_refs: refs, updated_at: new Date().toISOString() })
            .eq('id', post.id);
          if (upErr) throw upErr;
          rendered++;
          console.log(
            `rendered ${post.id} (${post.post_type}) → ${refs.length} image(s)`,
          );
        } else {
          skipped++;
        }
      } catch (e) {
        failed++;
        console.error(`FAILED ${post.id}: ${(e as Error).message}`);
      }
    }
  } finally {
    await renderer.onModuleDestroy();
  }

  console.log(
    JSON.stringify({
      considered: targets.length,
      rendered,
      skipped,
      failed,
    }),
  );
}

void main();
