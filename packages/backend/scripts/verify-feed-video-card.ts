// Dev-only E2E proof for the video-card feed lane: creates ONE real draft post
// in the real DB whose media is a real 8s 1080x1350 MP4 composited from that
// metro's own city-confident Pexels b-roll — no mocks anywhere. Uses the
// production MetroBrollService, VideoCardComposerService and PostVideoCardService.
//
// Honest-skip is the point: metros whose clips fail the slug/tags alignment gate
// produce NO video card, and the script says so and moves on.
//
// Run: npx ts-node --transpile-only scripts/verify-feed-video-card.ts
import 'reflect-metadata';
import { config } from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { SupabaseService } from '../src/supabase/supabase.service';
import { fetchTopMovers } from '../src/content-pipeline/data/score-mover-context.queries';
import { buildGrounding } from '../src/content-pipeline/feed/feed-helpers';
import { marketCityForQuery } from '../src/content-pipeline/post-images/post-image-names';
import { MetroBrollService } from '../src/content-pipeline/media/metro-broll.service';
import { VideoCardComposerService } from '../src/content-pipeline/media/video-card-composer.service';
import { PostVideoCardService } from '../src/content-pipeline/post-images/post-video-card.service';
import { PuppeteerPostImageRenderer } from '../src/content-pipeline/post-images/post-image-renderer';
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
  body: 'The PropertyIQ Score tracks where demand is heading now, not what a home is worth.',
  cta: 'See the full score at propertyiq.app.',
  hashtags: ['#realestate'],
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

/** Metros whose Pexels clips are known to name the city in slug/tags. */
const KNOWN_COVERAGE = ['Chicago', 'Miami', 'Seattle', 'Nashville'];

async function resolveKnownCoverageMetros(client: SupabaseClient) {
  const out: Array<{
    id: string;
    canonical_name: string;
    geography: 'metro';
    state: null;
  }> = [];
  for (const city of KNOWN_COVERAGE) {
    const { data } = await client
      .from('geographies')
      .select('geography_id, name')
      .eq('geography_type', 'metro')
      .ilike('name', `${city}%`)
      .order('population', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.geography_id) {
      out.push({
        id: String(data.geography_id),
        canonical_name: String(data.name),
        geography: 'metro',
        state: null,
      });
    }
  }
  return out;
}

async function main(): Promise<void> {
  if (!url || !key)
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY missing');
  const client = createClient(url, key);
  const supabaseLike = {
    getClient: () => client,
  } as unknown as SupabaseService;
  const renderer = new PuppeteerPostImageRenderer();
  const videoCards = new PostVideoCardService(
    supabaseLike,
    renderer,
    new MetroBrollService(supabaseLike),
    new VideoCardComposerService(),
  );

  try {
    const movers = await fetchTopMovers(client, 'metro', 90, 25);
    // Real feed candidates first. The top movers skew to small metros with no
    // stock footage, so large metros known to clear the alignment gate are
    // appended as a fallback — still resolved from the real geographies table.
    const candidates = [
      ...movers.up,
      ...movers.down,
      ...(await resolveKnownCoverageMetros(client)),
    ];
    console.log(`${candidates.length} candidate metros`);
    const brandId = await resolveBrandId(client);
    const brollService = new MetroBrollService(supabaseLike);

    for (const mover of candidates) {
      const city = marketCityForQuery(mover.canonical_name, null);
      const grounding = buildGrounding(mover, null);

      // Ask ONCE whether this metro has city-confident b-roll; doing it here
      // rather than inside the seed loop avoids re-querying Pexels per seed.
      const broll = await brollService.getBroll(
        mover.id,
        city,
        process.env.PEXELS_API_KEY,
        grounding.state,
      );
      if (!broll) {
        console.log(
          `${city}: no city-confident b-roll — image post instead (honest skip)`,
        );
        continue;
      }
      console.log(
        `${city}: b-roll ${broll.provenance.optionId} — building card`,
      );

      // The rotation is seeded from the post id, so insert until this metro
      // gets a seed the photo-family gate accepts.
      let post: PostRow | null = null;
      let refs: Awaited<ReturnType<typeof videoCards.renderForPost>> = null;
      for (let i = 0; i < MAX_SEED_ATTEMPTS && !refs; i++) {
        const candidate = await insertDraft(client, brandId);
        refs = await videoCards.renderForPost(candidate, grounding);
        if (refs) {
          post = candidate;
          break;
        }
        await client.from('posts').delete().eq('id', candidate.id);
      }

      if (!post || !refs) {
        console.log(
          `${city}: no video card — falling back to image (honest skip)`,
        );
        continue;
      }

      await client
        .from('posts')
        .update({ media_refs: refs, updated_at: new Date().toISOString() })
        .eq('id', post.id);

      const dl = await client.storage
        .from(refs[0].bucket)
        .download(refs[0].storage_path);
      const bytes = dl.data
        ? Buffer.from(await dl.data.arrayBuffer())
        : Buffer.alloc(0);

      console.log('');
      console.log('=== REAL ARTIFACT ===');
      console.log(`metro:    ${mover.canonical_name} (CBSA ${mover.id})`);
      console.log(`post:     ${post.id} (status pending_review)`);
      console.log(`video:    ${refs[0].storage_path}`);
      console.log(
        `mp4:      ${bytes.length} bytes, ${refs[0].width}x${refs[0].height}, ${refs[0].duration_sec}s`,
      );
      console.log(
        `ftyp box: ${bytes.subarray(4, 8).toString('ascii')} (mp4 signature)`,
      );
      return;
    }
    throw new Error('no metro produced a video card');
  } finally {
    await renderer.onModuleDestroy().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error((err as Error).message);
  process.exit(1);
});
