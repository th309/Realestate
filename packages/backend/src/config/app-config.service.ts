/**
 * AppConfigService
 *
 * DB-first configuration service that reads from the `app_config` Supabase
 * table and falls back to environment variables when no DB entry exists.
 * Values are cached in memory with a 60-second TTL.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

const CACHE_TTL_MS = 60_000;

export interface AppConfigEntry {
  key: string;
  value: string;
  description: string | null;
  field_type: string | null;
  field_options: Record<string, unknown> | null;
  category: string | null;
  display_order: number | null;
  updated_at: string | null;
  updated_by: string | null;
}

interface CachedValue {
  value: string | null;
  fetchedAt: number;
}

@Injectable()
export class AppConfigService {
  private readonly logger = new Logger(AppConfigService.name);
  private readonly cache = new Map<string, CachedValue>();

  constructor(
    private readonly supabase: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get a config value. Checks DB first (with cache), then env var, then default.
   */
  async get(key: string, defaultValue = ''): Promise<string> {
    const dbValue = await this.fetchFromDbWithCache(key);
    if (dbValue !== null) {
      return dbValue;
    }

    const envValue = this.configService.get<string>(key);
    if (envValue !== undefined && envValue !== null) {
      return envValue;
    }

    return defaultValue;
  }

  /**
   * Get a boolean config value.
   * Treats 'true' and '1' as true, everything else as false.
   */
  async getBool(key: string, defaultValue = false): Promise<boolean> {
    const raw = await this.get(key, String(defaultValue));
    return raw === 'true' || raw === '1';
  }

  /**
   * Get a numeric config value.
   * Returns defaultValue if the stored value is not a valid number.
   */
  async getNumber(key: string, defaultValue = 0): Promise<number> {
    const raw = await this.get(key, String(defaultValue));
    const parsed = Number(raw);
    return Number.isNaN(parsed) ? defaultValue : parsed;
  }

  /**
   * Get all config entries for a given category.
   */
  async getAllByCategory(category: string): Promise<AppConfigEntry[]> {
    try {
      const client = this.supabase.getClient();
      const { data, error } = await client
        .from('app_config')
        .select('*')
        .eq('category', category)
        .order('display_order', { ascending: true });

      if (error) {
        this.logger.warn(
          `Failed to fetch app_config for category "${category}": ${error.message}`,
        );
        return [];
      }

      return (data ?? []) as AppConfigEntry[];
    } catch (err) {
      this.logger.warn(
        `DB unavailable when fetching category "${category}": ${err.message}`,
      );
      return [];
    }
  }

  /**
   * Upsert a config value and invalidate its cache entry.
   */
  async set(key: string, value: string, updatedBy: string): Promise<void> {
    const client = this.supabase.getClient();
    const { error } = await client.from('app_config').upsert(
      {
        key,
        value,
        updated_by: updatedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    );

    if (error) {
      this.logger.error(`Failed to set app_config key "${key}": ${error.message}`);
      throw new Error(`Failed to update config key "${key}": ${error.message}`);
    }

    // Invalidate cache for this key so the next read picks up the new value
    this.cache.delete(key);
  }

  /**
   * Clear the entire in-memory cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Fetch a single key from DB, using the in-memory cache (60s TTL).
   * Returns null if the key does not exist in DB or if the DB is unavailable.
   */
  private async fetchFromDbWithCache(key: string): Promise<string | null> {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.value;
    }

    try {
      const client = this.supabase.getClient();
      const { data, error } = await client
        .from('app_config')
        .select('value')
        .eq('key', key)
        .single();

      if (error || !data) {
        // Key not in DB — cache the miss so we don't hit DB on every call
        this.cache.set(key, { value: null, fetchedAt: Date.now() });
        return null;
      }

      const value = data.value as string;
      this.cache.set(key, { value, fetchedAt: Date.now() });
      return value;
    } catch (err) {
      // DB unavailable — silently fall through to env var
      this.logger.warn(`DB unavailable when fetching key "${key}": ${err.message}`);
      return null;
    }
  }
}
