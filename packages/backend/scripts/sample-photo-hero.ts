// Dev-only PROOF render for the photo-hero family: resolve 5 real metros (CBSA +
// score) from the production DB, fetch each skyline via the real source chain
// (curated Wikimedia for Austin, Pexels subject-aligned for the rest), embed as a
// data URI, and render mixed stat/hook photo cards. Reports provenance per metro
// (never prints the API key). Not part of the build/suite. Run:
//   npx ts-node --transpile-only scripts/sample-photo-hero.ts <outDir>
import 'reflect-metadata';
import { config } from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { join } from 'path';
import type { SupabaseService } from '../src/supabase/supabase.service';
import { MetroPhotoService } from '../src/content-pipeline/media/metro-photo.service';
import { scoreMomentumLabel } from '../src/content-pipeline/feed/feed-helpers';
import {
  marketCityForQuery,
  shortMarketName,
} from '../src/content-pipeline/post-images/post-image-names';
import {
  formatScore,
  scoreTone,
} from '../src/content-pipeline/post-images/post-image-shared';
import { PuppeteerPostImageRenderer } from '../src/content-pipeline/post-images/post-image-renderer';
import { buildSinglePostHtml } from '../src/content-pipeline/post-images/post-image-templates';
import type { PostImageContent } from '../src/content-pipeline/post-images/post-image.types';

const OUT = process.argv[2];
if (!OUT) {
  console.error('usage: sample-photo-hero.ts <outDir>');
  process.exit(1);
}
config({ path: ['.env.local', '.env'] });
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

const METROS = ['Austin', 'Houston', 'Denver', 'Phoenix', 'Nashville'];
const STAT_LOOK = new Set(['Austin', 'Houston', 'Denver']); // rest use the hook look

async function resolveMetro(
  client: SupabaseClient,
  city: string,
): Promise<{ cbsa: string; name: string; score: number | null } | null> {
  const { data: geo } = await client
    .from('geographies')
    .select('geography_id, name')
    .eq('geography_type', 'metro')
    .ilike('name', `${city}%`)
    .order('population', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!geo?.geography_id) return null;
  const { data: score } = await client
    .from('propertyiq_scores')
    .select('score')
    .eq('geography', 'metro')
    .eq('score_type', 'propertyiq')
    .eq('location_id', geo.geography_id)
    .order('score_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    cbsa: geo.geography_id as string,
    name: geo.name as string,
    score: (score?.score as number) ?? null,
  };
}

async function main() {
  if (!url || !key)
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY missing');
  const client = createClient(url, key);
  const supabaseShim = {
    getClient: () => client,
  } as unknown as SupabaseService;
  const photos = new MetroPhotoService(supabaseShim);

  const renderer = new PuppeteerPostImageRenderer();
  try {
    for (const city of METROS) {
      const metro = await resolveMetro(client, city);
      if (!metro) {
        console.log(`${city}: no metro resolved — skipping`);
        continue;
      }
      const queryCity = marketCityForQuery(metro.name, null);
      const photo = await photos.getSkylineDataUri(metro.cbsa, queryCity);
      if (!photo) {
        console.log(
          `${city} (CBSA ${metro.cbsa}): NO subject-aligned photo — would fall back to typographic (skipping sample)`,
        );
        continue;
      }
      const display = shortMarketName(metro.name, null);
      const momentum = scoreMomentumLabel(metro.score);
      const useStat = STAT_LOOK.has(city) && metro.score != null;
      const content: PostImageContent = {
        family: 'photo',
        template: 'single_post',
        variant: useStat ? 'photo_hero_stat' : 'photo_hero_hook',
        category: 'Market Signal',
        eyebrow: display,
        headline: useStat
          ? `How strong is ${queryCity} right now?`
          : `The market the numbers are watching`,
        subhead: useStat
          ? undefined
          : 'PropertyIQ reads demand momentum, not price.',
        cta: 'See the full score at propertyiq.app',
        stat: useStat
          ? {
              value: formatScore(metro.score) ?? '',
              label: `PropertyIQ Score${momentum ? ` · ${momentum.replace(/\b\w/g, (m) => m.toUpperCase())}` : ''}`,
              tone: scoreTone(metro.score),
            }
          : undefined,
        scaleScore: useStat ? metro.score : null,
        photoDataUri: photo.dataUri,
        asOf: 'Jun 30, 2026',
      };
      const png = await renderer.renderFitted(
        (scale) => buildSinglePostHtml(content, scale),
        1080,
        1350,
      );
      const file = `photo-hero-${city.toLowerCase()}.png`;
      writeFileSync(join(OUT, file), png);
      console.log(
        `wrote ${file} (${png.length} bytes) — source=${photo.provenance.provider} option=${photo.provenance.optionId}${photo.provenance.photographer ? ` by ${photo.provenance.photographer}` : ''}`,
      );
    }
  } finally {
    await renderer.onModuleDestroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
