import {
  Controller,
  Post,
  Param,
  BadRequestException,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { Inject } from '@nestjs/common';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthUserId } from '../common/decorators/auth-user';

const VALID_MILESTONE_KEYS = new Set([
  'first_market_viewed',
  'first_comparison',
  'first_score_explored',
  'first_quinn_query',
]);

@UseGuards(JwtAuthGuard)
@Controller('api/milestones')
export class MilestonesController {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * POST /api/milestones/:key
   *
   * Idempotent upsert — records the milestone if not already achieved.
   * Returns { isNew: boolean } so the frontend knows whether to show a toast.
   */
  @Post(':key')
  @HttpCode(HttpStatus.OK)
  async recordMilestone(
    @Param('key') key: string,
    @AuthUserId() userId: string,
  ): Promise<{ isNew: boolean }> {
    if (!VALID_MILESTONE_KEYS.has(key)) {
      throw new BadRequestException(`Unknown milestone key: ${key}`);
    }

    // Check if already achieved
    const { data: existing } = await this.supabase
      .from('user_milestones')
      .select('id')
      .eq('user_id', userId)
      .eq('milestone_key', key)
      .single();

    if (existing) {
      return { isNew: false };
    }

    // Insert (idempotent via unique constraint)
    const { error } = await this.supabase.from('user_milestones').insert({
      user_id: userId,
      milestone_key: key,
    });

    // Conflict = already inserted concurrently — still not new to the user
    if (error && error.code === '23505') {
      return { isNew: false };
    }

    return { isNew: !error };
  }
}
