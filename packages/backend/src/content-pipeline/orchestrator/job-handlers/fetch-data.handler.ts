import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service';
import { RunOrchestratorService } from '../run-orchestrator.service';
import { ContentDataService } from '../../data/content-data.service';
import {
  getMetricFormat,
  getMetricLabel,
} from '../../ranking/ranking-display-metadata';

@Injectable()
export class FetchDataHandler {
  constructor(
    private readonly orchestrator: RunOrchestratorService,
    private readonly data: ContentDataService,
    private readonly supabase: SupabaseService,
  ) {}

  async handle(runId: string): Promise<void> {
    try {
      const client = this.supabase.getClient();
      const { data: run } = await client
        .from('content_runs')
        .select('market_query, format, format_options')
        .eq('id', runId)
        .single();
      if (!run) throw new Error('run not found');

      // Ranking formats don't have a single market — they have N markets that
      // the operator already approved at preview time. Skip the resolveMarket
      // / getMarketSnapshot path and build the dataBundle straight from the
      // persisted ranking snapshot.
      if (
        run.format === 'top_10_ranking' ||
        run.format === 'bottom_10_ranking'
      ) {
        await this.handleRankingRun(client, runId, run);
        return;
      }

      const candidates = await this.data.resolveMarket(run.market_query);
      if (candidates.length === 0)
        throw new Error(`no market match for "${run.market_query}"`);
      const resolvedGeo = {
        geography: candidates[0].geography,
        id: candidates[0].id,
        canonical_name: candidates[0].canonical_name,
      };

      const snapshot = await this.data.getMarketSnapshot(resolvedGeo);

      const formatOptions = (run.format_options ?? {}) as {
        windowDays?: 30 | 90 | 180 | 365;
        priorDate?: string;
        windowLabel?: string;
      };

      let augmentedSnapshot: Record<string, unknown> =
        snapshot as unknown as Record<string, unknown>;
      let formatOptionsToPersist: typeof formatOptions | null = null;

      if (run.format === 'score_mover') {
        const windowDays = formatOptions.windowDays ?? 90;
        const geo = resolvedGeo.geography as 'metro' | 'county' | 'zip';
        if (!['metro', 'county', 'zip'].includes(geo)) {
          throw new Error(
            `score_mover does not support geography=${geo}; resolved market is ${resolvedGeo.canonical_name}`,
          );
        }

        const ctx = await this.data.getScoreMoverContext(
          resolvedGeo.id,
          geo,
          windowDays,
        );
        if (!ctx) {
          throw new Error(
            `no_prior_score_for_window: no propertyiq score within ~${windowDays}d at ${geo} level for ${resolvedGeo.canonical_name}`,
          );
        }

        const existingScore = (augmentedSnapshot.score ?? {}) as Record<
          string,
          unknown
        >;
        augmentedSnapshot = {
          ...augmentedSnapshot,
          score: {
            ...existingScore,
            score_delta: ctx.delta,
            previous_score: ctx.prior.score,
            previous_score_date: ctx.prior.scoreDate,
            window_days: ctx.windowDays,
            window_label: ctx.windowLabel,
            window_caption: ctx.windowCaption,
          },
        };

        // Idempotent snapshot: only write priorDate/windowLabel if not already
        // present, so re-renders against a refreshed score table do not shift
        // the delta the operator approved.
        if (!formatOptions.priorDate || !formatOptions.windowLabel) {
          formatOptionsToPersist = {
            windowDays,
            priorDate: ctx.prior.scoreDate,
            windowLabel: ctx.windowLabel,
          };
        }
      }

      const updatePayload: Record<string, unknown> = {
        resolved_geo: resolvedGeo,
      };
      if (formatOptionsToPersist) {
        updatePayload.format_options = formatOptionsToPersist;
      }
      await client.from('content_runs').update(updatePayload).eq('id', runId);

      // Idempotent write: a prior run or manual re-enqueue may have left an
      // mcp_payload row behind. Downstream handlers use .single() which blows
      // up on 2+ rows, so we clear first.
      await client
        .from('content_assets')
        .delete()
        .eq('run_id', runId)
        .eq('kind', 'mcp_payload');
      await client.from('content_assets').insert({
        run_id: runId,
        kind: 'mcp_payload',
        storage_url: 'inline',
        metadata: augmentedSnapshot,
      });

      const bundleBytes = JSON.stringify(augmentedSnapshot).length;
      await client.from('content_run_events').insert({
        run_id: runId,
        event_type: 'fetch_data_done',
        payload: {
          format: run.format,
          path: 'single_market',
          resolved_geo: resolvedGeo,
          bundle_keys: Object.keys(augmentedSnapshot),
          bundle_bytes: bundleBytes,
        },
      });

      await this.orchestrator.handleStepSuccess(runId);
    } catch (err) {
      await this.orchestrator.handleStepFailure(
        runId,
        `fetch_data: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Build the dataBundle for a ranking run from format_options.ranking
   * (the snapshot the operator approved at preview time) and persist it as
   * the mcp_payload. No market lookup; the markets are already resolved.
   *
   * Shape matches what generateRankingScript() in the script generator reads:
   * { metric, scope, geo_level, direction, resolved_markets }.
   */
  private async handleRankingRun(
    client: ReturnType<SupabaseService['getClient']>,
    runId: string,
    run: { format: string; format_options: unknown },
  ): Promise<void> {
    const formatOptions = (run.format_options ?? {}) as {
      ranking?: {
        metric: { id: string };
        geo_level: 'metro' | 'county' | 'zip';
        scope: { type: 'national' | 'state' | 'metro'; id: string | null };
        resolved_markets: Array<{
          rank: number;
          region_id: string;
          region_name: string;
          state: string | null;
          value: number;
          value_formatted: string;
        }>;
      };
    };
    const ranking = formatOptions.ranking;
    if (!ranking) {
      throw new Error(
        'ranking_params_missing: run has no ranking snapshot in format_options',
      );
    }

    const direction = run.format === 'top_10_ranking' ? 'top' : 'bottom';
    const metricId = ranking.metric.id;
    const dataBundle = {
      format: run.format,
      direction,
      geo_level: ranking.geo_level,
      metric: {
        id: metricId,
        label: getMetricLabel(metricId),
        format: getMetricFormat(metricId),
        unit: '',
      },
      scope: {
        type: ranking.scope.type,
        id: ranking.scope.id,
        label: ranking.scope.id ?? 'National',
      },
      resolved_markets: ranking.resolved_markets,
    };

    // Idempotent write — clear any prior mcp_payload before insert.
    await client
      .from('content_assets')
      .delete()
      .eq('run_id', runId)
      .eq('kind', 'mcp_payload');
    await client.from('content_assets').insert({
      run_id: runId,
      kind: 'mcp_payload',
      storage_url: 'inline',
      metadata: dataBundle,
    });

    await client.from('content_run_events').insert({
      run_id: runId,
      event_type: 'fetch_data_done',
      payload: {
        format: run.format,
        path: 'ranking',
        market_count: ranking.resolved_markets.length,
        metric_id: metricId,
        scope_type: ranking.scope.type,
        scope_id: ranking.scope.id,
        geo_level: ranking.geo_level,
        bundle_bytes: JSON.stringify(dataBundle).length,
      },
    });

    await this.orchestrator.handleStepSuccess(runId);
  }
}
