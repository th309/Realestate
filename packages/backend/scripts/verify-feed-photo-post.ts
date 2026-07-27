// Dev-only E2E proof for the feed auto-photo lane: creates ONE real draft post
// in the real DB whose image is a photo-hero card backed by a real, subject-
// aligned skyline — no mocks anywhere. Uses the production MetroPhotoService
// (cache -> curated Wikimedia -> Pexels with the alignment gate) and the
// production PostImageRenderService + Puppeteer renderer.
//
// Because the variant is chosen deterministically from the post id, the script
// inserts a post, asks the real selector which look that seed produces, and
// retries with a fresh row until the rotation lands on a photo variant — which
// is itself proof that photo variants are now eligible without taking over.
//
// Run: npx ts-node --transpile-only scripts/verify-feed-photo-post.ts
import 'reflect-metadata';
import { config } from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseService } from '../src/supabase/supabase.service';
import { fetchTopMovers } from '../src/content-pipeline/data/score-mover-context.queries';
import {
  buildGrounding,
  stateFromCanonicalName,
} from '../src/content-pipeline/feed/feed-helpers';
import { marketCityForQuery } from '../src/content-pipeline/post-images/post-image-names';
import { MetroPhotoService } from '../src/content-pipeline/media/metro-photo.service';
import { PostImageRenderService } from '../src/content-pipeline/post-images/post-image-render.service';
import { PuppeteerPostImageRenderer } from '../src/content-pipeline/post-images/post-image-renderer';
import { selectAndBuildSingle } from '../src/content-pipeline/post-images/post-image-content';
import type {
  PostCopy,
  PostRow,
} from '../src/content-pipeline/posts/post.types';

config({ path: ['.env.local', '.env'] });
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

const MAX_SEED_ATTEMPTS = 30;

const COPY: PostCopy = {
  hook: 'Momentum is building in this market.',
  body: 'The PropertyIQ Score tracks where demand is heading now, not what a home is worth. Check the full picture on the map.',
  cta: 'See your market free at propertyiq.app.',
  hashtags: ['#realestate', '#housingmarket'],
};

async function resolveBrandId(client: SupabaseClient): Promise<string> {
  const { data, error } = await client
    .from('brands')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('no brand row — generate a feed post first');
  return data.id as string;
}

async function insertDraft(
  client: SupabaseClient,
  brandId: string,
): Promise<PostRow> {
  const now = new Date().toISOString();
  const { data, error } = await client
    .from('posts')
    .insert({
      brand_id: brandId,
      platform: 'linkedin',
      post_type: 'linkedin_post',
      copy: COPY,
      media_refs: [],
      status: 'pending_review',
      source: 'ai_generated',
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as PostRow;
}

async function main(): Promise<void> {
  if (!url || !key)
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY missing');
  const client = createClient(url, key);
  const supabaseLike = {
    getClient: () => client,
  } as unknown as SupabaseService;
  const photos = new MetroPhotoService(supabaseLike);
  const renderer = new PuppeteerPostImageRenderer();
  const images = new PostImageRenderService(supabaseLike, renderer);

  try {
    const movers = await fetchTopMovers(client, 'metro', 90, 25);
    const candidates = [...movers.up, ...movers.down];
    console.log(`${candidates.length} real metro movers`);

    // First metro with a confidently-aligned skyline wins.
    let chosen: { mover: (typeof candidates)[number]; dataUri: string } | null =
      null;
    for (const mover of candidates) {
      const city = marketCityForQuery(mover.canonical_name, null);
      const state = stateFromCanonicalName(mover.canonical_name);
      const photo = await photos
        .getSkylineDataUri(mover.id, city, process.env.PEXELS_API_KEY, state)
        .catch(() => null);
      if (photo) {
        console.log(
          `photo for ${mover.canonical_name} (CBSA ${mover.id}) via ${photo.provenance.provider}/${photo.provenance.optionId}`,
        );
        chosen = { mover, dataUri: photo.dataUri };
        break;
      }
      console.log(`no confident photo for ${city} — skipping (honest skip)`);
    }
    if (!chosen) throw new Error('no metro had a confident skyline photo');

    const grounding = {
      ...buildGrounding(chosen.mover, null),
      photoDataUri: chosen.dataUri,
    };

    // Insert until the deterministic rotation picks a photo look.
    let post: PostRow | null = null;
    let variant = '';
    const brandId = await resolveBrandId(client);
    for (let i = 0; i < MAX_SEED_ATTEMPTS; i++) {
      const candidate = await insertDraft(client, brandId);
      const built = selectAndBuildSingle(COPY, grounding, candidate.id);
      if (built.content.family === 'photo') {
        post = candidate;
        variant = String(built.content.variant);
        console.log(`seed attempt ${i + 1}: photo variant ${variant}`);
        break;
      }
      await client.from('posts').delete().eq('id', candidate.id);
    }
    if (!post) {
      throw new Error(
        `no photo variant selected in ${MAX_SEED_ATTEMPTS} attempts`,
      );
    }

    const refs = await images.renderForPost(post, grounding);
    if (refs.length === 0) throw new Error('renderForPost produced no images');
    await client
      .from('posts')
      .update({ media_refs: refs, updated_at: new Date().toISOString() })
      .eq('id', post.id);

    console.log('');
    console.log('=== REAL ARTIFACT ===');
    console.log(
      `metro:   ${chosen.mover.canonical_name} (CBSA ${chosen.mover.id})`,
    );
    console.log(`variant: ${variant}`);
    console.log(`post:    ${post.id} (status pending_review)`);
    console.log(`image:   ${refs[0].storage_path}`);
  } finally {
    await renderer.onModuleDestroy().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error((err as Error).message);
  process.exit(1);
});
