// Dev-only PROOF render for the video-card lane (samples-only, NOT feed-wired):
// resolve real metros (CBSA + score) from prod, fetch subject-aligned Pexels b-roll
// (city confirmed in the video's slug/tags — no alt on videos), render the photo-
// hero card as a TRANSPARENT overlay, and composite to an ~8s 1080x1350 MP4 with
// ffmpeg. b-roll cached locally per metro (one download). Per-metro try/catch;
// honest skips. Run:  npx ts-node --transpile-only scripts/sample-video-card.ts <outDir>
import 'reflect-metadata';
import { config } from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { searchCitySkylineVideo } from '../src/content-pipeline/media/pexels-media';
import {
  formatAsOfDate,
  scoreMomentumLabel,
} from '../src/content-pipeline/feed/feed-helpers';
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
  console.error('usage: sample-video-card.ts <outDir>');
  process.exit(1);
}
config({ path: ['.env.local', '.env'] });
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const pexelsKey = process.env.PEXELS_API_KEY;

// Metros with confident Pexels video coverage (slug/tags name the city) — scanned
// live; Houston/Austin/NYC/LA return 0 city-confident clips (thin/wrong-city).
const METROS = ['Chicago', 'Miami', 'Seattle', 'Nashville', 'Philadelphia'];
const STAT_LOOK = new Set(['Chicago', 'Miami', 'Seattle']);
const CACHE = join(OUT, '.broll-cache');

async function resolveMetro(client: SupabaseClient, city: string) {
  const { data: geo, error: geoErr } = await client
    .from('geographies')
    .select('geography_id, name')
    .eq('geography_type', 'metro')
    .ilike('name', `${city}%`)
    .order('population', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (geoErr) throw new Error(`geographies: ${geoErr.message}`);
  if (!geo?.geography_id) return null;
  const { data: score, error: scoreErr } = await client
    .from('propertyiq_scores')
    .select('score, score_date')
    .eq('geography', 'metro')
    .eq('score_type', 'propertyiq')
    .eq('location_id', geo.geography_id)
    .order('score_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (scoreErr) throw new Error(`score: ${scoreErr.message}`);
  return {
    name: geo.name as string,
    score: (score?.score as number) ?? null,
    scoreDate: (score?.score_date as string) ?? null,
  };
}

async function fetchBroll(city: string, downloadUrl: string): Promise<string> {
  if (!existsSync(CACHE)) mkdirSync(CACHE, { recursive: true });
  const path = join(CACHE, `${city.toLowerCase()}.mp4`);
  if (existsSync(path)) return path; // one download per metro
  const res = await fetch(downloadUrl);
  if (!res.ok) throw new Error(`b-roll download HTTP ${res.status}`);
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  return path;
}

function composite(broll: string, overlay: string, out: string): void {
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-stream_loop',
      '-1',
      '-t',
      '8',
      '-i',
      broll,
      '-loop',
      '1',
      '-t',
      '8',
      '-i',
      overlay,
      // Overlay is rendered at 2x (2160x1350*2); scale it back to the canvas
      // (supersamples the text) before compositing, else only its top-left quarter shows.
      '-filter_complex',
      '[0:v]scale=1080:1350:force_original_aspect_ratio=increase,crop=1080:1350,fps=30,setsar=1[bg];[1:v]scale=1080:1350[ov];[bg][ov]overlay=0:0[v]',
      '-map',
      '[v]',
      '-t',
      '8',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      out,
    ],
    { stdio: 'ignore' },
  );
}

async function main() {
  if (!url || !key)
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_KEY missing');
  if (!pexelsKey) throw new Error('PEXELS_API_KEY missing');
  const client = createClient(url, key);
  const renderer = new PuppeteerPostImageRenderer();
  try {
    for (const city of METROS) {
      try {
        const metro = await resolveMetro(client, city);
        if (!metro) {
          console.log(`${city}: no metro resolved — skipping`);
          continue;
        }
        const queryCity = marketCityForQuery(metro.name, null);
        const video = await searchCitySkylineVideo(queryCity, pexelsKey);
        if (!video) {
          console.log(
            `${city}: NO city-confident b-roll — skipping (no wrong-city clip)`,
          );
          continue;
        }
        const broll = await fetchBroll(city, video.downloadUrl);
        const momentum = scoreMomentumLabel(metro.score);
        const useStat = STAT_LOOK.has(city) && metro.score != null;
        const content: PostImageContent = {
          family: 'photo',
          template: 'single_post',
          variant: useStat ? 'photo_hero_stat' : 'photo_hero_hook',
          category: 'Market Signal',
          eyebrow: shortMarketName(metro.name, null),
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
          // no photoDataUri: the b-roll IS the background; overlay is gradient+text only
          asOf: formatAsOfDate(metro.scoreDate),
        };
        const overlayPng = await renderer.renderTransparentPng(
          buildSinglePostHtml(content, 1, { transparentBody: true }),
          1080,
          1350,
        );
        const overlayPath = join(CACHE, `overlay-${city.toLowerCase()}.png`);
        writeFileSync(overlayPath, overlayPng);
        const outFile = join(OUT, `video-card-${city.toLowerCase()}.mp4`);
        composite(broll, overlayPath, outFile);
        console.log(
          `wrote video-card-${city.toLowerCase()}.mp4 — pexels video ${video.id} by ${video.user} (${video.durationSec}s src), asOf=${content.asOf}`,
        );
      } catch (e) {
        console.log(
          `${city}: FAILED — ${e instanceof Error ? e.message : String(e)} (batch continues)`,
        );
      }
    }
  } finally {
    await renderer.onModuleDestroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
