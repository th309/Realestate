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
   * Search for geographies by name (primarily for official CBSA/Metro lookups)
   */
  async searchGeographies(
    query: string,
    type?: string,
    limit: number = 5,
  ): Promise<any[]> {
    this.logger.log(`Searching geographies: "${query}" (type: ${type || 'all'})`);

    let dbQuery = this.supabase
      .from('geographies')
      .select('geography_id, geography_type, name, name_short, state_code, cbsa_code, cbsa_name, latitude, longitude')
      .ilike('name', `%${query}%`)
      .limit(limit);

    if (type) {
      dbQuery = dbQuery.eq('geography_type', type);
    }

    const { data, error } = await dbQuery;

    if (error) {
      this.logger.error(`Error searching geographies: ${error.message}`);
      throw error;
    }

    return data || [];
  }
}
