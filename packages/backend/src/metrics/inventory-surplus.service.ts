import { Injectable, Inject } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { CacheEntry, GeographyType } from './inventory-surplus.types';
import {
  calculateForMetros,
  calculateForStates,
} from './inventory-surplus-backfill-metros-states.helper';
import { calculateForNational } from './inventory-surplus-backfill-national.helper';
import {
  calculateForCounties,
  calculateForZips,
} from './inventory-surplus-backfill-counties-zips.helper';
import { getForMap } from './inventory-surplus-map.helper';

/**
 * Inventory Surplus Calculation Service
 *
 * Calculates and stores inventory surplus/deficit for all geographic levels.
 * Formula: Current Inventory - Historical Average Inventory
 *
 * Positive values = more inventory than typical (buyer's market)
 * Negative values = less inventory than typical (seller's market)
 */
@Injectable()
export class InventorySurplusService {
  // In-memory cache for fast repeated queries
  private cache = new Map<string, CacheEntry<any[]>>();
  private latestDateCache = new Map<string, CacheEntry<string>>();

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Calculate and store inventory surplus for all metros
   */
  async calculateForMetros(year?: number): Promise<{
    processed: number;
    stored: number;
    debug?: any;
  }> {
    return calculateForMetros(this.supabase, year);
  }

  /**
   * Calculate and store inventory surplus for national level
   */
  async calculateForNational(
    year?: number,
  ): Promise<{ processed: number; stored: number }> {
    return calculateForNational(this.supabase, year);
  }

  /**
   * Calculate and store inventory surplus for all states
   */
  async calculateForStates(
    year?: number,
  ): Promise<{ processed: number; stored: number }> {
    return calculateForStates(this.supabase, year);
  }

  /**
   * Calculate and store inventory surplus for all counties (paginated)
   */
  async calculateForCounties(
    year?: number,
  ): Promise<{ processed: number; stored: number }> {
    return calculateForCounties(this.supabase, year);
  }

  /**
   * Calculate and store inventory surplus for all zip codes (paginated)
   */
  async calculateForZips(
    year?: number,
  ): Promise<{ processed: number; stored: number }> {
    return calculateForZips(this.supabase, year);
  }

  /**
   * Calculate inventory surplus for all geographies
   */
  async calculateForAll(year?: number): Promise<{
    national: { processed: number; stored: number };
    metros: { processed: number; stored: number };
    states: { processed: number; stored: number };
    counties: { processed: number; stored: number };
    zips: { processed: number; stored: number };
  }> {
    const [national, metros, states, counties, zips] = await Promise.all([
      this.calculateForNational(year),
      this.calculateForMetros(year),
      this.calculateForStates(year),
      this.calculateForCounties(),
      this.calculateForZips(),
    ]);

    return { national, metros, states, counties, zips };
  }

  /**
   * Get pre-calculated inventory surplus data for map display
   * For ZIP geography, pass state to filter at database level for faster queries
   */
  async getForMap(
    geographyType: GeographyType,
    state?: string,
  ): Promise<{ data: any[]; success: boolean; source: string }> {
    return getForMap(
      this.supabase,
      this.cache,
      this.latestDateCache,
      geographyType,
      state,
    );
  }
}
