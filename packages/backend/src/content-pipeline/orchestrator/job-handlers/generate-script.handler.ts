import { Injectable, Inject } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service';
import { RunOrchestratorService } from '../run-orchestrator.service';
import {
  SCRIPT_GENERATOR,
  ScriptGenerator,
} from '../../drivers/script-generator.interface';

@Injectable()
export class GenerateScriptHandler {
  constructor(
    private readonly orchestrator: RunOrchestratorService,
    @Inject(SCRIPT_GENERATOR) private readonly scriptGen: ScriptGenerator,
    private readonly supabase: SupabaseService,
  ) {}

  async handle(runId: string): Promise<void> {
    try {
      const client = this.supabase.getClient();
      const { data: run } = await client
        .from('content_runs')
        .select('format, audience, resolved_geo')
        .eq('id', runId)
        .single();
      if (!run) throw new Error('run not found');

      const { data: payload } = await client
        .from('content_assets')
        .select('metadata')
        .eq('run_id', runId)
        .eq('kind', 'mcp_payload')
        .single();
      if (!payload) throw new Error('mcp_payload asset not found');

      const { data: binding } = await client
        .from('format_magnet_bindings')
        .select('cta_text')
        .eq('format', run.format)
        .eq('enabled', true)
        .single();

      const result = await this.scriptGen.generate({
        format: run.format,
        audience: run.audience,
        resolvedMarket: run.resolved_geo,
        dataBundle: payload.metadata,
        variantCount: 1,
        ctaText: binding?.cta_text ?? 'Get your free Market Snapshot at ',
      });

      await client
        .from('content_runs')
        .update({
          hook_variants: result.scripts,
          costs: { script: [result.cost] },
        })
        .eq('id', runId);

      await client.from('content_assets').insert([
        {
          run_id: runId,
          kind: 'script',
          storage_url: 'inline',
          metadata: { scripts: result.scripts },
        },
        {
          run_id: runId,
          kind: 'script_raw',
          storage_url: 'inline',
          metadata: { raw: result.rawLLMResponse },
        },
      ]);

      await this.orchestrator.handleStepSuccess(runId);
    } catch (err) {
      await this.orchestrator.handleStepFailure(
        runId,
        `scripting: ${(err as Error).message}`,
      );
    }
  }
}
