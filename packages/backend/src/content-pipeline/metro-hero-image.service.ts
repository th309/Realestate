import { Injectable, Logger } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { SupabaseService } from '../supabase/supabase.service';
import {
  downloadImageBytes,
  imageExt,
  imageMime,
  sanitizeStorageSegment,
} from './media/download-image';

const BUCKET = 'content-pipeline';
const SIGN_SEC = 7200;

/** Curated skyline option surfaced to operators and matched to downloads. */
export interface MetroHeroOptionPublic {
  id: string;
  label: string;
  license_note?: string;
  /** Wikimedia/CDN thumbnail — suitable for wizard preview `<img src>`. */
  preview_url: string;
}

export interface MetroHeroOptionBundle {
  id: string;
  label: string;
  license_note?: string;
  source_url: string;
}

let bundledOptionsByCbsa: Record<string, MetroHeroOptionBundle[]> | null = null;

/** Curated (Wikimedia) skyline options keyed by CBSA — shared with the photo chain. */
export function loadBundledHeroOptions(): Record<
  string,
  MetroHeroOptionBundle[]
> {
  if (bundledOptionsByCbsa) return bundledOptionsByCbsa;
  const pathOpts = join(__dirname, 'data', 'metro-hero-options.json');
  const pathLegacy = join(__dirname, 'data', 'metro-hero-source-urls.json');

  let merged: Record<string, MetroHeroOptionBundle[]> = {};

  if (existsSync(pathOpts)) {
    try {
      merged = JSON.parse(readFileSync(pathOpts, 'utf-8')) as Record<
        string,
        MetroHeroOptionBundle[]
      >;
    } catch {
      merged = {};
    }
  }

  if (existsSync(pathLegacy)) {
    try {
      const legacy = JSON.parse(readFileSync(pathLegacy, 'utf-8')) as Record<
        string,
        string
      >;
      for (const [cbsa, url] of Object.entries(legacy)) {
        if (!merged[cbsa]?.length && url?.trim()) {
          merged[cbsa] = [
            {
              id: 'default',
              label: 'Skyline (curated)',
              source_url: url.trim(),
            },
          ];
        }
      }
    } catch {
      /* ignore */
    }
  }

  bundledOptionsByCbsa = merged;
  return bundledOptionsByCbsa;
}

/**
 * Downloads hero skyline images once per (metro, option), stores in Supabase Storage,
 * and exposes time-limited signed URLs for Remotion during render_video.
 */
@Injectable()
export class MetroHeroImageService {
  private readonly logger = new Logger(MetroHeroImageService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Options for admin wizard — preview uses stable HTTPS thumbnails (no signing).
   */
  listPublicOptionsForCbsa(cbsaCode: string): MetroHeroOptionPublic[] {
    const cbsa = String(cbsaCode ?? '').trim();
    if (!cbsa) return [];

    const bundled = loadBundledHeroOptions();
    const rows = bundled[cbsa] ?? [];
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      license_note: r.license_note,
      preview_url: r.source_url,
    }));
  }

  /**
   * Signed Storage URL for the chosen curated shot. Called at render time so TTL stays fresh.
   * When `optionId` is omitted, uses the first listed option for that CBSA.
   */
  async getSignedHeroUrlForMetro(
    cbsaCode: string,
    optionId?: string | null,
  ): Promise<string | null> {
    const cbsa = String(cbsaCode ?? '').trim();
    if (!cbsa) return null;

    const bundled = loadBundledHeroOptions();
    const options = bundled[cbsa];
    if (!options?.length) return null;

    const wanted = optionId?.trim();
    let selected = wanted ? options.find((o) => o.id === wanted) : undefined;
    if (wanted && !selected) {
      this.logger.warn(
        `[metro-hero] unknown option_id=${wanted} for CBSA=${cbsa} — using first option`,
      );
    }
    if (!selected) {
      selected = options[0];
    }

    const sourceUrl = selected.source_url?.trim();
    if (!sourceUrl) return null;

    const optionKey = sanitizeStorageSegment(selected.id);
    const client = this.supabase.getClient();

    const { data: existing } = await client
      .from('metro_hero_images')
      .select('storage_path')
      .eq('cbsa_code', cbsa)
      .eq('option_id', selected.id)
      .maybeSingle();

    let storagePath = existing?.storage_path as string | undefined;

    if (!storagePath) {
      const img = await downloadImageBytes(sourceUrl);
      storagePath = `metro-heroes/${cbsa}/${optionKey}.${imageExt(img.contentType)}`;
      const { error: uploadErr } = await client.storage
        .from(BUCKET)
        .upload(storagePath, img.bytes, {
          contentType: imageMime(img.contentType),
          upsert: true,
        });
      if (uploadErr) {
        throw new Error(`metro hero upload: ${uploadErr.message}`);
      }

      const { error: insertErr } = await client
        .from('metro_hero_images')
        .insert({
          cbsa_code: cbsa,
          option_id: selected.id,
          storage_path: storagePath,
          source_url: sourceUrl,
        });
      if (insertErr?.code === '23505') {
        const { data: row } = await client
          .from('metro_hero_images')
          .select('storage_path')
          .eq('cbsa_code', cbsa)
          .eq('option_id', selected.id)
          .maybeSingle();
        storagePath = row?.storage_path as string | undefined;
      } else if (insertErr) {
        throw new Error(`metro hero DB insert: ${insertErr.message}`);
      }
      if (!storagePath) {
        throw new Error('metro hero storage path unresolved after insert race');
      }
      this.logger.log(
        `[metro-hero] cached CBSA=${cbsa} option=${selected.id} path=${storagePath}`,
      );
    }

    const { data: signed, error: signErr } = await client.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, SIGN_SEC);
    if (signErr || !signed?.signedUrl) {
      throw new Error(signErr?.message ?? 'metro hero signed URL failed');
    }
    return signed.signedUrl;
  }
}
