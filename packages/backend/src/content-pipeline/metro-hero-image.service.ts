import { Injectable, Logger } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { SupabaseService } from '../supabase/supabase.service';

const BUCKET = 'content-pipeline';
const SIGN_SEC = 7200;
const FETCH_TIMEOUT_MS = 30_000;
const MAX_BYTES = 15 * 1024 * 1024;

/** Curated skyline option surfaced to operators and matched to downloads. */
export interface MetroHeroOptionPublic {
  id: string;
  label: string;
  license_note?: string;
  /** Wikimedia/CDN thumbnail — suitable for wizard preview `<img src>`. */
  preview_url: string;
}

interface MetroHeroOptionBundle {
  id: string;
  label: string;
  license_note?: string;
  source_url: string;
}

let bundledOptionsByCbsa: Record<string, MetroHeroOptionBundle[]> | null =
  null;

function loadBundledHeroOptions(): Record<string, MetroHeroOptionBundle[]> {
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
      const legacy = JSON.parse(
        readFileSync(pathLegacy, 'utf-8'),
      ) as Record<string, string>;
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

function sanitizeOptionIdForPath(id: string): string {
  const s = String(id ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return s.length > 0 ? s : 'option';
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
    let selected =
      wanted ? options.find((o) => o.id === wanted) : undefined;
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

    const optionKey = sanitizeOptionIdForPath(selected.id);
    const client = this.supabase.getClient();

    const { data: existing } = await client
      .from('metro_hero_images')
      .select('storage_path')
      .eq('cbsa_code', cbsa)
      .eq('option_id', selected.id)
      .maybeSingle();

    let storagePath = existing?.storage_path as string | undefined;

    if (!storagePath) {
      const buffer = await this.downloadRemoteImage(sourceUrl);
      storagePath = `metro-heroes/${cbsa}/${optionKey}.jpg`;
      const { error: uploadErr } = await client.storage
        .from(BUCKET)
        .upload(storagePath, buffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });
      if (uploadErr) {
        throw new Error(`metro hero upload: ${uploadErr.message}`);
      }

      const { error: insertErr } = await client.from('metro_hero_images').insert({
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
      .createSignedUrl(storagePath!, SIGN_SEC);
    if (signErr || !signed?.signedUrl) {
      throw new Error(signErr?.message ?? 'metro hero signed URL failed');
    }
    return signed.signedUrl;
  }

  private async downloadRemoteImage(url: string): Promise<Buffer> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: ctrl.signal,
        headers: { Accept: 'image/*' },
      });
      clearTimeout(timer);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const ct = res.headers.get('content-type') ?? '';
      if (!ct.startsWith('image/')) {
        throw new Error(`unexpected content-type: ${ct}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > MAX_BYTES) {
        throw new Error('image exceeds max size');
      }
      return buf;
    } finally {
      clearTimeout(timer);
    }
  }
}
