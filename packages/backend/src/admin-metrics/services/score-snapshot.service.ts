/**
 * ScoreSnapshotService
 *
 * Produces one admin_score_snapshots row per score type (propertyiq — the
 * unified demand-signal score) by calling the compute_propertyiq_score_health
 * stored function. The function aggregates propertyiq_scores_v2 forward
 * returns against state benchmarks from zhvi_forward_returns.
 *
 * Errors are NOT silently caught: if the RPC fails, the cron aborts so the
 * failure surfaces in logs instead of writing null-metric rows.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SCORE_TYPES, ScoreType } from './snapshot-recorder.constants';

export interface ScoreSnapshotRow {
  score_type: string;
  correlation_1y: number | null;
  correlation_3y: number | null;
  hit_rate_1y: number | null;
  hit_rate_3y: number | null;
  top_quintile_hit_rate_1y: number | null;
  top_quintile_hit_rate_3y: number | null;
  scores_validated: number;
  scores_validated_3y: number;
  scores_pending: number;
  scores_failed: number;
}

interface HealthRpcRow {
  hit_rate_1y: number | null;
  hit_rate_3y: number | null;
  top_quintile_hit_rate_1y: number | null;
  top_quintile_hit_rate_3y: number | null;
  correlation_1y: number | null;
  correlation_3y: number | null;
  scores_validated: number | null;
  scores_validated_3y: number | null;
  scores_pending: number | null;
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
    // Only 'propertyiq' is supported by the stored function today. If new
    // score types are added later, branch here on scoreType.
    if (scoreType !== 'propertyiq') {
      throw new Error(
        `[ScoreSnapshot] Unsupported score type: ${scoreType}. ` +
          `compute_propertyiq_score_health only supports 'propertyiq'.`,
      );
    }

    const { data, error } = await client.rpc('compute_propertyiq_score_health');

    if (error) {
      this.logger.error(
        `[ScoreSnapshot] compute_propertyiq_score_health RPC failed: ${error.message}`,
      );
      throw new Error(`Score snapshot aggregation failed: ${error.message}`);
    }

    const row = (data as HealthRpcRow[] | null)?.[0];
    if (!row) {
      throw new Error(
        '[ScoreSnapshot] compute_propertyiq_score_health returned no rows',
      );
    }

    return {
      score_type: scoreType,
      hit_rate_1y: row.hit_rate_1y,
      hit_rate_3y: row.hit_rate_3y,
      top_quintile_hit_rate_1y: row.top_quintile_hit_rate_1y,
      top_quintile_hit_rate_3y: row.top_quintile_hit_rate_3y,
      correlation_1y: row.correlation_1y,
      correlation_3y: row.correlation_3y,
      scores_validated: row.scores_validated ?? 0,
      scores_validated_3y: row.scores_validated_3y ?? 0,
      scores_pending: row.scores_pending ?? 0,
      scores_failed: 0, // No "failed" state is tracked in propertyiq_scores_v2.
    };
  }
}
