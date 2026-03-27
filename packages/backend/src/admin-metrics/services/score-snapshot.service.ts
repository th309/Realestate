/**
 * ScoreSnapshotService
 *
 * For each score type (homeready, investor_edge, market_health), fetches the
 * latest validation stats and counts validated vs pending scores from Supabase.
 * Callers persist the results to admin_score_snapshots.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SCORE_TYPES, ScoreType } from './snapshot-recorder.constants';

export interface ScoreSnapshotRow {
  score_type: string;
  correlation_1y: number | null;
  hit_rate_1y: number | null;
  scores_validated: number;
  scores_pending: number;
  scores_failed: number;
}

@Injectable()
export class ScoreSnapshotService {
  private readonly logger = new Logger(ScoreSnapshotService.name);

  async buildScoreSnapshotRows(
    client: SupabaseClient,
  ): Promise<ScoreSnapshotRow[]> {
    return Promise.all(
      SCORE_TYPES.map((scoreType) =>
        this.buildRowForScoreType(client, scoreType),
      ),
    );
  }

  private async buildRowForScoreType(
    client: SupabaseClient,
    scoreType: ScoreType,
  ): Promise<ScoreSnapshotRow> {
    const [validationStats, scoreCounts] = await Promise.all([
      this.fetchLatestValidationStats(client, scoreType),
      this.fetchScoreCounts(client, scoreType),
    ]);

    return {
      score_type: scoreType,
      correlation_1y: validationStats.correlation1y,
      hit_rate_1y: validationStats.hitRate1y,
      scores_validated: scoreCounts.validated,
      scores_pending: scoreCounts.pending,
      scores_failed: 0, // No "failed" state currently tracked in schema
    };
  }

  private async fetchLatestValidationStats(
    client: SupabaseClient,
    scoreType: ScoreType,
  ): Promise<{ correlation1y: number | null; hitRate1y: number | null }> {
    const { data, error } = await client
      .from('score_validation_results')
      .select('correlation_1y, hit_rate_1y')
      .eq('score_type', scoreType)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      this.logger.warn(
        `[ScoreSnapshot] score_validation_results query failed for ${scoreType}: ${error.message}`,
      );
      return { correlation1y: null, hitRate1y: null };
    }

    const row = data?.[0];
    return {
      correlation1y: row?.correlation_1y ?? null,
      hitRate1y: row?.hit_rate_1y ?? null,
    };
  }

  private async fetchScoreCounts(
    client: SupabaseClient,
    scoreType: ScoreType,
  ): Promise<{ validated: number; pending: number }> {
    const { data, error } = await client
      .from('propertyiq_scores')
      .select('validated_at')
      .eq('score_type', scoreType);

    if (error) {
      this.logger.warn(
        `[ScoreSnapshot] propertyiq_scores query failed for ${scoreType}: ${error.message}`,
      );
      return { validated: 0, pending: 0 };
    }

    let validated = 0;
    let pending = 0;

    for (const row of data ?? []) {
      if (row.validated_at) validated++;
      else pending++;
    }

    return { validated, pending };
  }
}
