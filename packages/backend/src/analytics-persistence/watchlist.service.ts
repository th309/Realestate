/**
 * Watchlist Service
 *
 * CRUD operations for user's market watchlist.
 */

import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { EntitlementsService } from '../entitlements/entitlements.service';

export interface WatchlistItem {
  id: string;
  user_id: string;
  geography_type: string;
  geography_id: string;
  geography_name?: string;
  tags?: string[];
  folder?: string;
  added_at: string;
  score_at_add?: number;
}

export interface AddToWatchlistDto {
  geography_type: string;
  geography_id: string;
  geography_name?: string;
  tags?: string[];
  folder?: string;
  score_at_add?: number;
}

export interface UpdateWatchlistItemDto {
  tags?: string[];
  folder?: string;
}

@Injectable()
export class WatchlistService {
  private readonly logger = new Logger(WatchlistService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly entitlements: EntitlementsService,
  ) {}

  /**
   * Get all watchlist items for a user
   */
  async getAll(userId: string, folder?: string): Promise<WatchlistItem[]> {
    const client = this.supabase.getClient();

    let query = client
      .from('analytics_watchlist')
      .select('*')
      .eq('user_id', userId)
      .order('added_at', { ascending: false });

    if (folder) {
      query = query.eq('folder', folder);
    }

    const { data, error } = await query;

    if (error) {
      this.logger.error(`Failed to get watchlist: ${error.message}`);
      throw new Error(error.message);
    }

    return data || [];
  }

  /**
   * Get watchlist grouped by folder
   */
  async getGroupedByFolder(
    userId: string,
  ): Promise<Record<string, WatchlistItem[]>> {
    const items = await this.getAll(userId);

    const grouped: Record<string, WatchlistItem[]> = {
      _unfiled: [],
    };

    for (const item of items) {
      const folder = item.folder || '_unfiled';
      if (!grouped[folder]) {
        grouped[folder] = [];
      }
      grouped[folder].push(item);
    }

    return grouped;
  }

  /**
   * Check if a market is in the watchlist
   */
  async isInWatchlist(
    userId: string,
    geographyType: string,
    geographyId: string,
  ): Promise<boolean> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('analytics_watchlist')
      .select('id')
      .eq('user_id', userId)
      .eq('geography_type', geographyType)
      .eq('geography_id', geographyId)
      .single();

    if (error && error.code !== 'PGRST116') {
      this.logger.error(`Failed to check watchlist: ${error.message}`);
    }

    return !!data;
  }

  /**
   * Check if the user is within their watchlist limit
   */
  async checkWatchlistLimit(
    userId: string,
  ): Promise<{ allowed: boolean; current: number; limit: number }> {
    const currentCount = await this.getCount(userId);
    const entitlementsResult = await this.entitlements.checkAccess(
      userId,
      null,
      ['feature:watchlist_limit'],
    );
    const access = entitlementsResult.access['feature:watchlist_limit'];

    // -1 means unlimited, undefined means no limit configured
    const limit = access?.limit ?? 0;
    if (limit === -1)
      return { allowed: true, current: currentCount, limit: -1 };

    return { allowed: currentCount < limit, current: currentCount, limit };
  }

  /**
   * Add a market to the watchlist
   */
  async add(userId: string, dto: AddToWatchlistDto): Promise<WatchlistItem> {
    // Enforce entitlement limit before inserting
    const limitCheck = await this.checkWatchlistLimit(userId);
    if (!limitCheck.allowed) {
      throw new HttpException(
        'Watchlist limit reached. Upgrade to add more markets.',
        HttpStatus.FORBIDDEN,
      );
    }

    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('analytics_watchlist')
      .insert({
        user_id: userId,
        geography_type: dto.geography_type,
        geography_id: dto.geography_id,
        geography_name: dto.geography_name,
        tags: dto.tags,
        folder: dto.folder,
        score_at_add: dto.score_at_add,
      })
      .select()
      .single();

    if (error) {
      // Handle duplicate
      if (error.code === '23505') {
        throw new Error('Market already in watchlist');
      }
      this.logger.error(`Failed to add to watchlist: ${error.message}`);
      throw new Error(error.message);
    }

    this.logger.log(
      `Added to watchlist: ${dto.geography_type}/${dto.geography_id} for user ${userId}`,
    );
    return data;
  }

  /**
   * Update a watchlist item
   */
  async update(
    userId: string,
    itemId: string,
    dto: UpdateWatchlistItemDto,
  ): Promise<WatchlistItem> {
    const client = this.supabase.getClient();

    const updateData: Record<string, unknown> = {};
    if (dto.tags !== undefined) updateData.tags = dto.tags;
    if (dto.folder !== undefined) updateData.folder = dto.folder;

    const { data, error } = await client
      .from('analytics_watchlist')
      .update(updateData)
      .eq('user_id', userId)
      .eq('id', itemId)
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to update watchlist item: ${error.message}`);
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Remove from watchlist by item ID
   */
  async remove(userId: string, itemId: string): Promise<boolean> {
    const client = this.supabase.getClient();

    const { error } = await client
      .from('analytics_watchlist')
      .delete()
      .eq('user_id', userId)
      .eq('id', itemId);

    if (error) {
      this.logger.error(`Failed to remove from watchlist: ${error.message}`);
      throw new Error(error.message);
    }

    this.logger.log(`Removed from watchlist: ${itemId}`);
    return true;
  }

  /**
   * Remove from watchlist by geography
   */
  async removeByGeography(
    userId: string,
    geographyType: string,
    geographyId: string,
  ): Promise<boolean> {
    const client = this.supabase.getClient();

    const { error } = await client
      .from('analytics_watchlist')
      .delete()
      .eq('user_id', userId)
      .eq('geography_type', geographyType)
      .eq('geography_id', geographyId);

    if (error) {
      this.logger.error(`Failed to remove from watchlist: ${error.message}`);
      throw new Error(error.message);
    }

    return true;
  }

  /**
   * Get all unique folders for a user
   */
  async getFolders(userId: string): Promise<string[]> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('analytics_watchlist')
      .select('folder')
      .eq('user_id', userId)
      .not('folder', 'is', null);

    if (error) {
      this.logger.error(`Failed to get folders: ${error.message}`);
      return [];
    }

    const folders = new Set<string>();
    for (const item of data || []) {
      if (item.folder) folders.add(item.folder);
    }

    return Array.from(folders).sort();
  }

  /**
   * Get count of watchlist items
   */
  async getCount(userId: string): Promise<number> {
    const client = this.supabase.getClient();

    const { count, error } = await client
      .from('analytics_watchlist')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) {
      this.logger.error(`Failed to get watchlist count: ${error.message}`);
      return 0;
    }

    return count || 0;
  }
}
