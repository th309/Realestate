/**
 * Geography Chain Service
 *
 * Provides geographic parent chain lookups (ZIP -> County -> Metro -> State -> National)
 * with LRU caching. Consolidates the logic from scoring/inheritance.service.ts
 * into a general-purpose service usable by all consumers.
 *
 * Uses the geography_crosswalk table: zip_code, county_fips, cbsa_code, state_fips.
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import {
  GeoLevel,
  GeographyCrosswalkRow,
  GeoChainStep,
} from './metric-resolution.types';

/** Max entries in the crosswalk LRU cache */
const CACHE_MAX_SIZE = 2000;

@Injectable()
export class GeographyChainService {
  private readonly logger = new Logger(GeographyChainService.name);

  /**
   * LRU cache: geoId -> crosswalk row.
   * Key is `${geoLevel}:${geoId}` to avoid collisions across levels.
   */
  private readonly cache = new Map<string, GeographyCrosswalkRow | null>();

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Build the inheritance order for a geography.
   * Returns an ordered list starting with the geography itself,
   * then its parents up to national.
   *
   * Example for ZIP 80423:
   *   [{ id: '80423', level: 'zip' },
   *    { id: '08019', level: 'county' },
   *    { id: '14500', level: 'metro' },
   *    { id: '08', level: 'state' },
   *    { id: 'national', level: 'national' }]
   */
  async getInheritanceChain(
    geoLevel: GeoLevel,
    geoId: string,
  ): Promise<GeoChainStep[]> {
    const chain: GeoChainStep[] = [{ id: geoId, level: geoLevel }];

    // National has no parents
    if (geoLevel === 'national') return chain;

    const crosswalk = await this.lookupCrosswalk(geoLevel, geoId);
    if (!crosswalk) return chain;

    switch (geoLevel) {
      case 'zip':
        if (crosswalk.county_fips) chain.push({ id: crosswalk.county_fips, level: 'county' });
        if (crosswalk.cbsa_code) chain.push({ id: crosswalk.cbsa_code, level: 'metro' });
        if (crosswalk.state_fips) chain.push({ id: crosswalk.state_fips, level: 'state' });
        chain.push({ id: 'national', level: 'national' });
        break;

      case 'county':
        if (crosswalk.cbsa_code) chain.push({ id: crosswalk.cbsa_code, level: 'metro' });
        if (crosswalk.state_fips) chain.push({ id: crosswalk.state_fips, level: 'state' });
        chain.push({ id: 'national', level: 'national' });
        break;

      case 'metro':
        if (crosswalk.state_fips) chain.push({ id: crosswalk.state_fips, level: 'state' });
        chain.push({ id: 'national', level: 'national' });
        break;

      case 'state':
        chain.push({ id: 'national', level: 'national' });
        break;
    }

    return chain;
  }

  /**
   * Get the parent county FIPS for a ZIP code.
   * Used by the batch scoring backfill (many ZIPs -> county mappings).
   */
  async getParentCountyForZip(zipCode: string): Promise<string | null> {
    const crosswalk = await this.lookupCrosswalk('zip', zipCode);
    return crosswalk?.county_fips ?? null;
  }

  /**
   * Bulk-fetch ZIP -> county mappings for a batch of ZIP codes.
   * More efficient than individual lookups for scoring batch operations.
   */
  async getZipToCountyMap(zipCodes: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const uncached: string[] = [];

    // Check cache first
    for (const zip of zipCodes) {
      const cacheKey = `zip:${zip}`;
      if (this.cache.has(cacheKey)) {
        const row = this.cache.get(cacheKey);
        if (row?.county_fips) result.set(zip, row.county_fips);
      } else {
        uncached.push(zip);
      }
    }

    // Fetch uncached in batches
    const pageSize = 1000;
    for (let i = 0; i < uncached.length; i += pageSize) {
      const batch = uncached.slice(i, i + pageSize);
      const { data, error } = await this.supabase
        .from('geography_crosswalk')
        .select('zip_code, county_fips, cbsa_code, state_fips')
        .in('zip_code', batch);

      if (error) {
        this.logger.warn(`Bulk crosswalk lookup failed: ${error.message}`);
        continue;
      }

      if (data) {
        for (const row of data as GeographyCrosswalkRow[]) {
          if (row.zip_code) {
            this.setCached(`zip:${row.zip_code}`, row);
            if (row.county_fips) result.set(row.zip_code, row.county_fips);
          }
        }
      }
    }

    // Mark unfound ZIPs as null in cache
    for (const zip of uncached) {
      if (!this.cache.has(`zip:${zip}`)) {
        this.setCached(`zip:${zip}`, null);
      }
    }

    return result;
  }

  /**
   * Get constituent counties for a metro (CBSA code).
   * Used for metro -> county crosswalk fallbacks in reports.
   */
  async getCountiesForMetro(cbsaCode: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .from('geography_crosswalk')
      .select('county_fips')
      .eq('cbsa_code', cbsaCode)
      .limit(50);

    if (error || !data) return [];
    return [...new Set(data.map(r => r.county_fips).filter(Boolean))] as string[];
  }

  // ==========================================================================
  // Internal: Crosswalk lookup with caching
  // ==========================================================================

  private async lookupCrosswalk(
    geoLevel: GeoLevel,
    geoId: string,
  ): Promise<GeographyCrosswalkRow | null> {
    const cacheKey = `${geoLevel}:${geoId}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) ?? null;
    }

    let filterCol: string;
    switch (geoLevel) {
      case 'zip': filterCol = 'zip_code'; break;
      case 'county': filterCol = 'county_fips'; break;
      case 'metro': filterCol = 'cbsa_code'; break;
      case 'state': filterCol = 'state_fips'; break;
      default: return null;
    }

    const { data, error } = await this.supabase
      .from('geography_crosswalk')
      .select('zip_code, county_fips, cbsa_code, state_fips')
      .eq(filterCol, geoId)
      .limit(1)
      .single();

    if (error || !data) {
      this.setCached(cacheKey, null);
      return null;
    }

    const row = data as GeographyCrosswalkRow;
    this.setCached(cacheKey, row);
    return row;
  }

  private setCached(key: string, value: GeographyCrosswalkRow | null): void {
    // Simple LRU: evict oldest when at capacity
    if (this.cache.size >= CACHE_MAX_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }

  /** Clear the cache (useful in tests) */
  clearCache(): void {
    this.cache.clear();
  }
}
