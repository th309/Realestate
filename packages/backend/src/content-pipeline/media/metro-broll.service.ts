// packages/backend/src/content-pipeline/media/metro-broll.service.ts
//
// B-roll source chain for the video-card lane, mirroring MetroPhotoService:
// metro_broll_videos row -> Pexels video search (subject-aligned) -> persist.
// One download per metro ever. Returned as a local temp file path rather than a
// data URI, because ffmpeg consumes a file, not bytes.
//
// Fail-safe: any miss/error returns null and the caller falls back to an image
// post. There is deliberately NO generic-city fallback — a wrong city's skyline
// is misleading content, worse than no video (Troy's alignment constraint).

import { Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { SupabaseService } from '../../supabase/supabase.service';
import { searchCitySkylineVideo } from './pexels-media';

const BUCKET = 'content-pipeline';
const TABLE = 'metro_broll_videos';
/** Bound the download so a slow CDN can never stall a feed run. */
const DOWNLOAD_TIMEOUT_MS = 30_000;
/** Pexels portrait clips are a few MB; anything larger is not b-roll we want. */
const MAX_BYTES = 60 * 1024 * 1024;

export interface BrollProvenance {
  provider: 'pexels';
  optionId: string;
  sourceUrl: string;
  durationSec: number | null;
}

export interface MetroBroll {
  /** Local temp path holding the clip, ready for ffmpeg. */
  filePath: string;
  provenance: BrollProvenance;
}

async function downloadVideoBytes(url: string): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`b-roll download HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length === 0) throw new Error('b-roll download was empty');
  if (bytes.length > MAX_BYTES) {
    throw new Error(`b-roll too large (${bytes.length} bytes)`);
  }
  return bytes;
}

@Injectable()
export class MetroBrollService {
  private readonly logger = new Logger(MetroBrollService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * City-confident b-roll for a metro, or null when nothing confident exists.
   * `city` is the bare city (marketCityForQuery output) used for the alignment
   * gate; `apiKey` defaults to PEXELS_API_KEY.
   */
  async getBroll(
    cbsa: string,
    city: string,
    apiKey: string | undefined = process.env.PEXELS_API_KEY,
    /** Metro state, so the gate can reject the same city name in another state. */
    state?: string | null,
  ): Promise<MetroBroll | null> {
    const cbsaCode = String(cbsa ?? '').trim();
    if (!cbsaCode) return null;
    const client = this.supabase.getClient();

    const cached = await this.readCache(client, cbsaCode).catch(() => null);
    if (cached) return cached;

    return this.populateFromPexels(client, cbsaCode, city, apiKey, state).catch(
      (e) => {
        this.logger.warn(
          `[metro-broll] pexels failed CBSA=${cbsaCode}: ${errMsg(e)}`,
        );
        return null;
      },
    );
  }

  /** Reuse previously cached b-roll. Deterministic: ordered by option_id. */
  private async readCache(
    client: SupabaseClient,
    cbsa: string,
  ): Promise<MetroBroll | null> {
    const { data } = await client
      .from(TABLE)
      .select('option_id, storage_path, source_url, duration_sec')
      .eq('cbsa_code', cbsa)
      .order('option_id', { ascending: true })
      .limit(1)
      .maybeSingle();
    const path = data?.storage_path as string | undefined;
    if (!path) return null;
    const dl = await client.storage.from(BUCKET).download(path);
    if (dl.error || !dl.data) return null;
    const bytes = Buffer.from(await dl.data.arrayBuffer());
    if (bytes.length === 0) return null;
    return {
      filePath: this.writeTemp(cbsa, bytes),
      provenance: {
        provider: 'pexels',
        optionId: (data?.option_id as string) ?? 'cached',
        sourceUrl: (data?.source_url as string) ?? '',
        durationSec: (data?.duration_sec as number | null) ?? null,
      },
    };
  }

  /** Search Pexels with the slug/tags alignment gate, then cache the bytes. */
  private async populateFromPexels(
    client: SupabaseClient,
    cbsa: string,
    city: string,
    apiKey: string | undefined,
    state?: string | null,
  ): Promise<MetroBroll | null> {
    const video = await searchCitySkylineVideo(city, apiKey, fetch, state);
    // No key, API error, or no clip whose slug/tags confidently name the city.
    if (!video) return null;

    const bytes = await downloadVideoBytes(video.downloadUrl);
    const optionId = `pexels-${video.id}`;
    const storagePath = `metro-broll/${cbsa}/${optionId}.mp4`;
    await this.persist(client, {
      cbsa,
      optionId,
      storagePath,
      bytes,
      sourceUrl: video.pageUrl,
      durationSec: video.durationSec,
    });
    return {
      filePath: this.writeTemp(cbsa, bytes),
      provenance: {
        provider: 'pexels',
        optionId,
        sourceUrl: video.pageUrl,
        durationSec: video.durationSec,
      },
    };
  }

  private writeTemp(cbsa: string, bytes: Buffer): string {
    const path = join(tmpdir(), `piq-broll-${cbsa}.mp4`);
    writeFileSync(path, bytes);
    return path;
  }

  /** Best-effort cache write: a failure still returns the fetched bytes. */
  private async persist(
    client: SupabaseClient,
    p: {
      cbsa: string;
      optionId: string;
      storagePath: string;
      bytes: Buffer;
      sourceUrl: string;
      durationSec: number;
    },
  ): Promise<void> {
    try {
      const up = await client.storage
        .from(BUCKET)
        .upload(p.storagePath, p.bytes, {
          contentType: 'video/mp4',
          upsert: true,
        });
      if (up.error) throw up.error;
      const { error } = await client.from(TABLE).insert({
        cbsa_code: p.cbsa,
        option_id: p.optionId,
        storage_path: p.storagePath,
        source_url: p.sourceUrl,
        duration_sec: p.durationSec,
      });
      if (error && error.code !== '23505') throw error; // 23505 = already cached
    } catch (e) {
      this.logger.warn(
        `[metro-broll] cache write skipped CBSA=${p.cbsa} option=${p.optionId}: ${errMsg(e)}`,
      );
    }
  }
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
