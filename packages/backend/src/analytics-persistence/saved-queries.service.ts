/**
 * Saved Queries Service
 *
 * CRUD operations for user's saved analytics queries.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface SavedQuery {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  query_text: string;
  query_params?: Record<string, unknown>;
  result_type?: string;
  is_favorite: boolean;
  run_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateSavedQueryDto {
  name: string;
  description?: string;
  query_text: string;
  query_params?: Record<string, unknown>;
  result_type?: string;
}

export interface UpdateSavedQueryDto {
  name?: string;
  description?: string;
  is_favorite?: boolean;
}

@Injectable()
export class SavedQueriesService {
  private readonly logger = new Logger(SavedQueriesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Get all saved queries for a user
   */
  async getAll(userId: string): Promise<SavedQuery[]> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('analytics_saved_queries')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to get saved queries: ${error.message}`);
      throw new Error(error.message);
    }

    return data || [];
  }

  /**
   * Get a single saved query by ID
   */
  async getById(userId: string, queryId: string): Promise<SavedQuery | null> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('analytics_saved_queries')
      .select('*')
      .eq('user_id', userId)
      .eq('id', queryId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      this.logger.error(`Failed to get saved query: ${error.message}`);
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Create a new saved query
   */
  async create(userId: string, dto: CreateSavedQueryDto): Promise<SavedQuery> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('analytics_saved_queries')
      .insert({
        user_id: userId,
        name: dto.name,
        description: dto.description,
        query_text: dto.query_text,
        query_params: dto.query_params,
        result_type: dto.result_type,
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create saved query: ${error.message}`);
      throw new Error(error.message);
    }

    this.logger.log(`Created saved query: ${data.id} for user ${userId}`);
    return data;
  }

  /**
   * Update a saved query
   */
  async update(
    userId: string,
    queryId: string,
    dto: UpdateSavedQueryDto,
  ): Promise<SavedQuery> {
    const client = this.supabase.getClient();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.is_favorite !== undefined) updateData.is_favorite = dto.is_favorite;

    const { data, error } = await client
      .from('analytics_saved_queries')
      .update(updateData)
      .eq('user_id', userId)
      .eq('id', queryId)
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to update saved query: ${error.message}`);
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Delete a saved query
   */
  async delete(userId: string, queryId: string): Promise<boolean> {
    const client = this.supabase.getClient();

    const { error } = await client
      .from('analytics_saved_queries')
      .delete()
      .eq('user_id', userId)
      .eq('id', queryId);

    if (error) {
      this.logger.error(`Failed to delete saved query: ${error.message}`);
      throw new Error(error.message);
    }

    this.logger.log(`Deleted saved query: ${queryId}`);
    return true;
  }

  /**
   * Increment run count for a saved query
   */
  async incrementRunCount(userId: string, queryId: string): Promise<void> {
    const client = this.supabase.getClient();

    const { error } = await client.rpc('increment_query_run_count', {
      p_user_id: userId,
      p_query_id: queryId,
    });

    // If RPC doesn't exist, do it manually
    if (error) {
      const { error: updateError } = await client
        .from('analytics_saved_queries')
        .update({
          run_count: client.rpc('increment', { x: 1 }),
          last_run_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('id', queryId);

      if (updateError) {
        this.logger.warn(`Failed to increment run count: ${updateError.message}`);
      }
    }
  }

  /**
   * Get favorites only
   */
  async getFavorites(userId: string): Promise<SavedQuery[]> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from('analytics_saved_queries')
      .select('*')
      .eq('user_id', userId)
      .eq('is_favorite', true)
      .order('updated_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to get favorites: ${error.message}`);
      throw new Error(error.message);
    }

    return data || [];
  }
}
