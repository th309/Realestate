/**
 * AI Insights Persistence Service
 *
 * CRUD operations for saved AI marketing insight reports.
 * Follows the SavedQueriesService pattern (Supabase client queries
 * with user-scoped row filtering).
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  SavedInsight,
  SavedInsightSummary,
  CreateInsightDto,
  UpdateInsightDto,
  SavedRecommendation,
  RecommendationStatus,
} from './ai-insights-persistence.types';

const TABLE = 'ai_marketing_insights';

@Injectable()
export class AiInsightsPersistenceService {
  private readonly logger = new Logger(AiInsightsPersistenceService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * List all saved insights for a user (summary only, no full markdown).
   */
  async getAll(userId: string): Promise<SavedInsightSummary[]> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from(TABLE)
      .select(
        'id, title, provider, days_analyzed, is_pinned, recommendations, created_at, updated_at',
      )
      .eq('user_id', userId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Failed to list insights: ${error.message}`);
      throw new Error(error.message);
    }

    return (data || []).map((row) => {
      const recs = (row.recommendations || []) as SavedRecommendation[];
      return {
        id: row.id,
        title: row.title,
        provider: row.provider,
        days_analyzed: row.days_analyzed,
        is_pinned: row.is_pinned,
        recommendation_count: recs.length,
        implemented_count: recs.filter((r) => r.status === 'implemented')
          .length,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    });
  }

  /**
   * Get a single insight with full content and recommendations.
   */
  async getById(userId: string, id: string): Promise<SavedInsight | null> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from(TABLE)
      .select('*')
      .eq('user_id', userId)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      this.logger.error(`Failed to get insight: ${error.message}`);
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Save a new insight report.
   */
  async create(userId: string, dto: CreateInsightDto): Promise<SavedInsight> {
    const client = this.supabase.getClient();

    const { data, error } = await client
      .from(TABLE)
      .insert({
        user_id: userId,
        title: dto.title,
        markdown_content: dto.markdown_content,
        recommendations: dto.recommendations,
        provider: dto.provider,
        days_analyzed: dto.days_analyzed,
        chat_history: dto.chat_history || [],
      })
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to create insight: ${error.message}`);
      throw new Error(error.message);
    }

    this.logger.log(`Created insight ${data.id} for user ${userId}`);
    return data;
  }

  /**
   * Update insight metadata (title, pin status).
   */
  async update(
    userId: string,
    id: string,
    dto: UpdateInsightDto,
  ): Promise<SavedInsight> {
    const client = this.supabase.getClient();

    const updateData: Record<string, unknown> = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.is_pinned !== undefined) updateData.is_pinned = dto.is_pinned;

    const { data, error } = await client
      .from(TABLE)
      .update(updateData)
      .eq('user_id', userId)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      this.logger.error(`Failed to update insight: ${error.message}`);
      throw new Error(error.message);
    }

    return data;
  }

  /**
   * Delete a saved insight.
   */
  async delete(userId: string, id: string): Promise<boolean> {
    const client = this.supabase.getClient();

    const { error } = await client
      .from(TABLE)
      .delete()
      .eq('user_id', userId)
      .eq('id', id);

    if (error) {
      this.logger.error(`Failed to delete insight: ${error.message}`);
      throw new Error(error.message);
    }

    this.logger.log(`Deleted insight ${id}`);
    return true;
  }

  /**
   * Update a single recommendation's status within an insight's JSONB array.
   */
  async updateRecommendationStatus(
    userId: string,
    insightId: string,
    recId: string,
    status: RecommendationStatus,
  ): Promise<SavedRecommendation | null> {
    const insight = await this.getById(userId, insightId);
    if (!insight) return null;

    const recs = insight.recommendations as SavedRecommendation[];
    const recIndex = recs.findIndex((r) => r.id === recId);
    if (recIndex === -1) return null;

    recs[recIndex] = { ...recs[recIndex], status };

    const client = this.supabase.getClient();
    const { error } = await client
      .from(TABLE)
      .update({ recommendations: recs })
      .eq('user_id', userId)
      .eq('id', insightId);

    if (error) {
      this.logger.error(
        `Failed to update recommendation status: ${error.message}`,
      );
      throw new Error(error.message);
    }

    this.logger.log(
      `Updated rec ${recId} in insight ${insightId} to ${status}`,
    );
    return recs[recIndex];
  }
}
