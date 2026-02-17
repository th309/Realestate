import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: any[];
}

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

@Injectable()
export class GeographyService implements OnModuleInit {
  private readonly logger = new Logger(GeographyService.name);

  // GeoJSON data is static - cache for 24 hours
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 2000; // 2 seconds
  private cache = new Map<string, CacheEntry<GeoJSONFeatureCollection>>();

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) { }

  /**
   * Pre-warm the cache on module initialization for frequently accessed data
   */
  async onModuleInit() {
    this.logger.log('Pre-warming GeoJSON cache...');
    // Warm cache in background to not block startup
    setTimeout(async () => {
      try {
        await this.getStatesGeoJSON();
        this.logger.log('States GeoJSON cached');
      } catch (e: any) {
        this.logger.warn('Failed to pre-warm states cache', e.message);
      }
      try {
        await this.getMetrosGeoJSON();
        this.logger.log('Metros GeoJSON cached');
      } catch (e: any) {
        this.logger.warn('Failed to pre-warm metros cache', e.message);
      }
      try {
        await this.getCountiesGeoJSON();
        this.logger.log('Counties GeoJSON cached');
      } catch (e: any) {
        this.logger.warn('Failed to pre-warm counties cache', e.message);
      }
    }, 1000);
  }

  /**
   * Execute RPC with retry logic for transient failures
   */
  private async executeWithRetry<T>(
    rpcName: string,
    params?: Record<string, any>,
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const { data, error } = params
          ? await this.supabase.rpc(rpcName, params)
          : await this.supabase.rpc(rpcName);

        if (error) {
          throw error;
        }
        return data as T;
      } catch (e: any) {
        lastError = e;
        this.logger.warn(
          `RPC ${rpcName} attempt ${attempt}/${this.MAX_RETRIES} failed: ${e.message}`,
        );
        if (attempt < this.MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, this.RETRY_DELAY * attempt));
        }
      }
    }

    throw (
      lastError ||
      new Error(`RPC ${rpcName} failed after ${this.MAX_RETRIES} attempts`)
    );
  }

  /**
   * Get cached data if available and not expired
   */
  private getCached(key: string): GeoJSONFeatureCollection | null {
    const entry = this.cache.get(key);
    if (entry && entry.expiry > Date.now()) {
      this.logger.debug(`Cache hit for ${key}`);
      return entry.data;
    }
    return null;
  }

  /**
   * Store data in cache
   */
  private setCache(key: string, data: GeoJSONFeatureCollection): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.CACHE_TTL,
    });
    this.logger.debug(`Cached ${key} with ${data.features.length} features`);
  }

  async getNationalGeoJSON(): Promise<GeoJSONFeatureCollection> {
    const cacheKey = 'national';
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    this.logger.log('Fetching national GeoJSON from database');
    const data = await this.executeWithRetry<GeoJSONFeatureCollection>(
      'get_national_geojson',
    );
    this.setCache(cacheKey, data);
    return data;
  }

  async getStatesGeoJSON(): Promise<GeoJSONFeatureCollection> {
    const cacheKey = 'states';
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    this.logger.log('Fetching states GeoJSON from database');
    const data =
      await this.executeWithRetry<GeoJSONFeatureCollection>(
        'get_states_geojson',
      );
    this.setCache(cacheKey, data);
    return data;
  }

  async getCountiesGeoJSON(): Promise<GeoJSONFeatureCollection> {
    const cacheKey = 'counties';
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    this.logger.log('Fetching all counties GeoJSON from database');
    const data = await this.executeWithRetry<GeoJSONFeatureCollection>(
      'get_counties_geojson',
    );
    this.setCache(cacheKey, data);
    return data;
  }

  async getCountiesGeoJSONByState(
    stateAbbrev: string,
  ): Promise<GeoJSONFeatureCollection> {
    const normalizedState = stateAbbrev.toUpperCase();
    const cacheKey = `counties:${normalizedState}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    this.logger.log(
      `Fetching counties GeoJSON for ${normalizedState} from database`,
    );
    const data = await this.executeWithRetry<GeoJSONFeatureCollection>(
      'get_counties_geojson_by_state',
      { p_state_abbrev: normalizedState },
    );
    this.setCache(cacheKey, data);
    return data;
  }

  async getMetrosGeoJSON(): Promise<GeoJSONFeatureCollection> {
    const cacheKey = 'metros';
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    this.logger.log('Fetching metros GeoJSON from database');
    const data =
      await this.executeWithRetry<GeoJSONFeatureCollection>(
        'get_metros_geojson',
      );
    this.setCache(cacheKey, data);
    return data;
  }

  async getZCTAByStateGeoJSON(
    stateAbbrev: string,
  ): Promise<GeoJSONFeatureCollection> {
    const normalizedState = stateAbbrev.toUpperCase();
    const cacheKey = `zcta:${normalizedState}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    this.logger.log(`Fetching ZCTAs for ${normalizedState} from database`);
    const data = await this.executeWithRetry<GeoJSONFeatureCollection>(
      'get_zcta_geojson_by_state',
      { p_state_abbrev: normalizedState },
    );
    this.setCache(cacheKey, data);
    return data;
  }

  async getPlacesByStateGeoJSON(
    stateAbbrev: string,
  ): Promise<GeoJSONFeatureCollection> {
    const normalizedState = stateAbbrev.toUpperCase();
    const cacheKey = `places:${normalizedState}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    this.logger.log(`Fetching places for ${normalizedState} from database`);
    const data = await this.executeWithRetry<GeoJSONFeatureCollection>(
      'get_places_geojson_by_state',
      { p_state_abbrev: normalizedState },
    );
    this.setCache(cacheKey, data);
    return data;
  }

  /**
   * Search for geographies by name (primarily for official CBSA/Metro lookups).
   * Results are ranked by relevance:
   *   1. Exact match on geography_id or name
   *   2. Name/id starts with query (prefix match)
   *   3. Substring match (sorted by population)
   */
  async searchGeographies(
    query: string,
    type?: string,
    limit: number = 15,
  ): Promise<any[]> {
    this.logger.log(`Searching geographies: "${query}" (type: ${type || 'all'})`);

    // Fetch more than needed so we can re-rank by relevance
    const fetchLimit = Math.max(limit * 3, 50);

    let dbQuery = this.supabase
      .from('geographies')
      .select('geography_id, geography_type, name, name_short, state_code, cbsa_code, cbsa_name, fips_code, latitude, longitude, population');

    // Split query into words so "washington dc" matches names containing
    // both "washington" AND "dc" even if they're not adjacent.
    // Single-word queries also match against name_short for short metro names.
    const words = query.trim().split(/\s+/).filter(Boolean);

    if (words.length === 1) {
      // Single word: match name OR name_short OR geography_id
      const pattern = `%${words[0]}%`;
      dbQuery = dbQuery.or(`name.ilike.${pattern},name_short.ilike.${pattern},geography_id.ilike.${pattern}`);
    } else {
      // Multi-word: each word must appear in the name (AND semantics)
      for (const word of words) {
        dbQuery = dbQuery.ilike('name', `%${word}%`);
      }
    }

    if (type) {
      dbQuery = dbQuery.eq('geography_type', type);
    }

    dbQuery = dbQuery
      .order('population', { ascending: false, nullsFirst: false })
      .limit(fetchLimit);

    const { data, error } = await dbQuery;

    if (error) {
      this.logger.error(`Error searching geographies: ${error.message}`);
      throw error;
    }

    if (!data || data.length === 0) return [];

    // Re-rank results by relevance
    const queryLower = query.trim().toLowerCase();

    const scored = data.map((row) => {
      const name = (row.name || '').toLowerCase();
      const nameShort = (row.name_short || '').toLowerCase();
      const geoId = (row.geography_id || '').toLowerCase();

      let relevance: number;

      if (geoId === queryLower || name === queryLower || nameShort === queryLower) {
        // Exact match — highest priority
        relevance = 0;
      } else if (geoId.startsWith(queryLower) || name.startsWith(queryLower) || nameShort.startsWith(queryLower)) {
        // Prefix match
        relevance = 1;
      } else {
        // Substring match
        relevance = 2;
      }

      return { ...row, _relevance: relevance };
    });

    // Sort by relevance first, then population as tiebreaker
    scored.sort((a, b) => {
      if (a._relevance !== b._relevance) return a._relevance - b._relevance;
      return (b.population || 0) - (a.population || 0);
    });

    // Strip internal field and return limited results
    return scored.slice(0, limit).map(({ _relevance, ...row }) => row);
  }
}
