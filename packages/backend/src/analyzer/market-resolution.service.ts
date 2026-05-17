/**
 * MarketResolutionService — slim, cached PIQ + median-DOM lookup for the
 * Fix & Flip auto-resolution path.
 *
 * Why a separate service (vs reusing MarketSnapshotService):
 *   The full snapshot fetches 7+ data sources in parallel for the analyzer UI.
 *   For the grader we only need two fields (marketDomDays, marketPiqScore),
 *   so we issue exactly the queries we need and cache the {DOM, PIQ} tuple
 *   in-process for 5 minutes. Keeps the cache hot, the response slim, and
 *   the cache key small (one tuple per market, not a full snapshot payload).
 *
 * Identifier resolution priority (most specific first):
 *   1. marketGeoId — assumed to be a 5-digit CBSA code (metro).
 *   2. marketZip — 5-digit ZIP.
 *   3. marketLat + marketLng — currently a no-op (no reverse-geocoder wired);
 *      the field is accepted in DTO for forward compatibility.
 *
 * Graceful failure: any error or missing identifier returns `{ marketDomDays:
 * null, marketPiqScore: null }`. The grading engine handles both nulls — the
 * EXTREME_HOLD auto-kill and hold_vs_dom advisory skip silently when DOM is
 * unknown; marketPiqScore null yields a 0 market adjustment.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { ScoringService } from '../scoring/scoring.service';
import type { GeographyLevel } from '../scoring/formula-weights';
import { normalizeCbsaCode } from '../common/geo';
import { normalizeZipKey } from '../common/zip';

export interface MarketIdentifier {
  marketGeoId?: string;
  marketZip?: string;
  marketLat?: number;
  marketLng?: number;
}

export interface MarketResolution {
  marketDomDays: number | null;
  marketPiqScore: number | null;
}

interface CacheEntry {
  value: MarketResolution;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const EMPTY_RESOLUTION: MarketResolution = {
  marketDomDays: null,
  marketPiqScore: null,
};

@Injectable()
export class MarketResolutionService {
  private readonly logger = new Logger(MarketResolutionService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
    private readonly scoring: ScoringService,
  ) {}

  /**
   * Resolve {marketDomDays, marketPiqScore} for the given identifier.
   * Cached for 5 minutes per (geoLevel, geoId) pair. Returns nulls on any
   * failure path — never throws.
   */
  async resolve(id: MarketIdentifier): Promise<MarketResolution> {
    const target = this.normalize(id);
    if (!target) return EMPTY_RESOLUTION;

    const cacheKey = `${target.level}:${target.id}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    // Parallel: DOM lookup + PIQ score. Each handles its own failure path.
    const [domDays, piqScore] = await Promise.all([
      this.fetchDom(target.level, target.id),
      this.fetchPiqScore(target.level, target.id),
    ]);

    const resolution: MarketResolution = {
      marketDomDays: domDays,
      marketPiqScore: piqScore,
    };
    this.cache.set(cacheKey, {
      value: resolution,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return resolution;
  }

  /** Test/debug helper — clear the in-process cache. */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Pick the most-specific available identifier and normalize to the form
   * the data layer expects. Returns null when nothing usable was passed.
   */
  private normalize(
    id: MarketIdentifier,
  ): { level: 'metro' | 'zip'; id: string } | null {
    if (id.marketGeoId) {
      const cbsa = normalizeCbsaCode(id.marketGeoId);
      if (cbsa) return { level: 'metro', id: cbsa };
    }
    if (id.marketZip) {
      const zip = normalizeZipKey(id.marketZip);
      if (zip) return { level: 'zip', id: zip };
    }
    // marketLat + marketLng: no reverse-geocoder yet. Field is accepted for
    // forward compatibility — Prompt 2 ships zip/geoId only.
    return null;
  }

  private async fetchDom(
    level: 'metro' | 'zip',
    geoId: string,
  ): Promise<number | null> {
    const table = level === 'metro' ? 'realtor_metro' : 'realtor_zip';
    const keyCol = level === 'metro' ? 'cbsa_code' : 'postal_code';
    try {
      const { data, error } = await this.supabase
        .from(table)
        .select('median_days_on_market')
        .eq(keyCol, geoId)
        .order('period_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      const raw = (data as { median_days_on_market: number | null })
        .median_days_on_market;
      return raw != null && Number.isFinite(raw) ? Number(raw) : null;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `fetchDom failed for ${level}/${geoId}: ${message} — returning null`,
      );
      return null;
    }
  }

  private async fetchPiqScore(
    level: 'metro' | 'zip',
    geoId: string,
  ): Promise<number | null> {
    try {
      const result = await this.scoring.getScore(
        geoId,
        level as GeographyLevel,
      );
      const piq = result?.scores?.propertyiq;
      if (piq && typeof piq.score === 'number') return piq.score;
      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `fetchPiqScore failed for ${level}/${geoId}: ${message} — returning null`,
      );
      return null;
    }
  }
}
