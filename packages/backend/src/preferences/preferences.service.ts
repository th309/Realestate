/**
 * Preferences Service
 *
 * CRUD operations for user quiz preferences stored in the
 * `user_preferences` table. Computes archetype_id on upsert
 * so InsightsService can generate personalized AI narratives.
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { UserPreferences, UserGoal } from './preferences.types';
import { computeArchetypeId } from './archetype-mapper';
import { UpsertPreferencesDto } from './upsert-preferences.dto';

@Injectable()
export class PreferencesService {
  private readonly logger = new Logger(PreferencesService.name);

  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Fetch the user's current preferences, or null if none exist.
   */
  async getPreferences(userId: string): Promise<UserPreferences | null> {
    const { data, error } = await this.supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      this.logger.error(
        `Failed to fetch preferences for user ${userId}: ${error.message}`,
      );
      throw new Error(`Failed to fetch preferences: ${error.message}`);
    }

    return data as UserPreferences | null;
  }

  /**
   * Upsert user preferences. Computes archetype_id from the submitted
   * answers and sets quiz_completed_at if goal + priorities are present.
   */
  async upsertPreferences(
    userId: string,
    dto: UpsertPreferencesDto,
  ): Promise<UserPreferences> {
    const archetypeId = computeArchetypeId(
      dto.goal as UserGoal | undefined,
      dto.priorities,
      dto.budget_max,
    );

    const isQuizComplete = !!(dto.goal && dto.priorities?.length);

    const upsertData = {
      user_id: userId,
      goal: dto.goal ?? null,
      priorities: dto.priorities ?? [],
      budget_min: dto.budget_min ?? null,
      budget_max: dto.budget_max ?? null,
      location_preferences: dto.location_preferences ?? [],
      timeline: dto.timeline ?? null,
      archetype_id: archetypeId,
      ...(isQuizComplete
        ? { quiz_completed_at: new Date().toISOString() }
        : {}),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('user_preferences')
      .upsert(upsertData, { onConflict: 'user_id' })
      .select('*')
      .single();

    if (error) {
      this.logger.error(
        `Failed to upsert preferences for user ${userId}: ${error.message}`,
      );
      throw new Error(`Failed to save preferences: ${error.message}`);
    }

    this.logger.log(
      `Upserted preferences for user ${userId} — archetype: ${archetypeId}`,
    );

    return data as UserPreferences;
  }

  /**
   * Quick lookup of the user's archetype ID for use by other services
   * (e.g., InsightsService for personalized narratives).
   */
  async getArchetypeId(userId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from('user_preferences')
      .select('archetype_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      this.logger.error(
        `Failed to fetch archetype for user ${userId}: ${error.message}`,
      );
      return null;
    }

    return data?.archetype_id ?? null;
  }
}
