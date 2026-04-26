import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service';
import { RunOrchestratorService } from '../run-orchestrator.service';
import { ContentDataService } from '../../data/content-data.service';

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

      await this.orchestrator.handleStepSuccess(runId);
    } catch (err) {
      await this.orchestrator.handleStepFailure(
        runId,
        `fetch_data: ${(err as Error).message}`,
      );
    }
  }
}
