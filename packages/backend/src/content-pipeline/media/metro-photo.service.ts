// packages/backend/src/content-pipeline/media/metro-photo.service.ts
//
// Skyline photo source chain for the photo-hero card, returned as a self-contained
// data URI so Puppeteer stays offline. Cache-first, then curated Wikimedia, then
// Pexels (subject-aligned): metro_hero_images row → curated bundled option →
// searchCitySkylinePhoto. One download per metro ever (lazy cache). Fail-safe:
// any miss/error returns null and the caller falls back to a typographic look — a
// photo problem never fails or delays a render. Cache WRITES are best-effort too;
// a persist failure still returns the fetched bytes.

import { Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../../supabase/supabase.service';
import { loadBundledHeroOptions } from '../metro-hero-image.service';
import { downloadImageBytes, toDataUri } from './download-image';
import { searchCitySkylinePhoto } from './pexels-media';

const BUCKET = 'content-pipeline';

/** Where a rendered skyline came from — recoverable for audit / replacement. */
export interface PhotoProvenance {
  provider: 'wikimedia' | 'pexels';
  optionId: string;
  sourceUrl: string;
  photographer?: string;
  alt?: string;
}

export interface SkylinePhoto {
  dataUri: string;
  provenance: PhotoProvenance;
}

function sanitizeId(id: string): string {
  const s = String(id ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return s.length > 0 ? s : 'option';
}

@Injectable()
export class MetroPhotoService {
  private readonly logger = new Logger(MetroPhotoService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Skyline photo for a metro (by CBSA) as a data URI, or null when nothing
   * confident exists. `city` is the bare city (marketCityForQuery output) used
   * for the Pexels alignment gate; `apiKey` defaults to PEXELS_API_KEY.
   */
  async getSkylineDataUri(
    cbsa: string,
    city: string,
    apiKey: string | undefined = process.env.PEXELS_API_KEY,
  ): Promise<SkylinePhoto | null> {
    const cbsaCode = String(cbsa ?? '').trim();
    if (!cbsaCode) return null;
    const client = this.supabase.getClient();

    const cached = await this.readCache(client, cbsaCode).catch(() => null);
    if (cached) return cached;

    const curated = await this.populateCurated(client, cbsaCode).catch((e) => {
      this.logger.warn(
        `[metro-photo] curated failed CBSA=${cbsaCode}: ${errMsg(e)}`,
      );
      return null;
    });
    if (curated) return curated;

    return this.populatePexels(client, cbsaCode, city, apiKey).catch((e) => {
      this.logger.warn(
        `[metro-photo] pexels failed CBSA=${cbsaCode}: ${errMsg(e)}`,
      );
      return null;
    });
  }

  /** Reuse a previously cached skyline (any option for the metro). */
  private async readCache(
    client: SupabaseClient,
    cbsa: string,
  ): Promise<SkylinePhoto | null> {
    const { data } = await client
      .from('metro_hero_images')
      .select('option_id, storage_path, source_url')
      .eq('cbsa_code', cbsa)
      .limit(1)
      .maybeSingle();
    const path = data?.storage_path as string | undefined;
    if (!path) return null;
    const dl = await client.storage.from(BUCKET).download(path);
    if (dl.error || !dl.data) return null;
    const bytes = Buffer.from(await dl.data.arrayBuffer());
    const optionId = (data?.option_id as string) ?? 'cached';
    return {
      dataUri: toDataUri({ bytes, contentType: 'image/jpeg' }),
      provenance: {
        provider: optionId.startsWith('pexels-') ? 'pexels' : 'wikimedia',
        optionId,
        sourceUrl: (data?.source_url as string) ?? '',
      },
    };
  }

  /** Populate from the curated Wikimedia option (the Austin path today). */
  private async populateCurated(
    client: SupabaseClient,
    cbsa: string,
  ): Promise<SkylinePhoto | null> {
    const option = loadBundledHeroOptions()[cbsa]?.[0];
    if (!option?.source_url) return null;
    const img = await downloadImageBytes(option.source_url);
    const storagePath = `metro-heroes/${cbsa}/${sanitizeId(option.id)}.jpg`;
    await this.persist(client, {
      cbsa,
      optionId: option.id,
      storagePath,
      bytes: img.bytes,
      sourceUrl: option.source_url,
    });
    return {
      dataUri: toDataUri(img),
      provenance: {
        provider: 'wikimedia',
        optionId: option.id,
        sourceUrl: option.source_url,
      },
    };
  }

  /** Populate from Pexels with the subject-alignment gate (city must match alt). */
  private async populatePexels(
    client: SupabaseClient,
    cbsa: string,
    city: string,
    apiKey: string | undefined,
  ): Promise<SkylinePhoto | null> {
    const photo = await searchCitySkylinePhoto(city, apiKey);
    if (!photo) return null; // no key, error, or no confident city match
    const img = await downloadImageBytes(photo.downloadUrl);
    const optionId = `pexels-${photo.id}`;
    const storagePath = `metro-heroes/${cbsa}/${optionId}.jpg`;
    // Provenance recoverable schema-averse: option_id carries the photo id,
    // source_url the Pexels page (photographer + alt live there).
    await this.persist(client, {
      cbsa,
      optionId,
      storagePath,
      bytes: img.bytes,
      sourceUrl: photo.pageUrl,
    });
    return {
      dataUri: toDataUri(img),
      provenance: {
        provider: 'pexels',
        optionId,
        sourceUrl: photo.pageUrl,
        photographer: photo.photographer,
        alt: photo.alt,
      },
    };
  }

  /** Best-effort cache write: upload + insert row; a failure never fails the render. */
  private async persist(
    client: SupabaseClient,
    p: {
      cbsa: string;
      optionId: string;
      storagePath: string;
      bytes: Buffer;
      sourceUrl: string;
    },
  ): Promise<void> {
    try {
      const up = await client.storage
        .from(BUCKET)
        .upload(p.storagePath, p.bytes, {
          contentType: 'image/jpeg',
          upsert: true,
        });
      if (up.error) throw up.error;
      const { error } = await client.from('metro_hero_images').insert({
        cbsa_code: p.cbsa,
        option_id: p.optionId,
        storage_path: p.storagePath,
        source_url: p.sourceUrl,
      });
      if (error && error.code !== '23505') throw error; // 23505 = already cached
    } catch (e) {
      this.logger.warn(
        `[metro-photo] cache write skipped CBSA=${p.cbsa} option=${p.optionId}: ${errMsg(e)}`,
      );
    }
  }
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
