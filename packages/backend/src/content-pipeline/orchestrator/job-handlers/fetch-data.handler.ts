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
        .select('market_query, format')
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

      await client
        .from('content_runs')
        .update({ resolved_geo: resolvedGeo })
        .eq('id', runId);
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
        metadata: snapshot,
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
