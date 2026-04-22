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

      const payload = await readMcpPayloadWithRetry(client, runId);
      if (!payload)
        throw new Error(
          'mcp_payload asset not found after retries (fetch-data did not persist it)',
        );

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
      const e = err as Error;
      console.error(
        `[generate-script] run=${runId} error=${e.message}\n${e.stack}`,
      );
      await this.orchestrator.handleStepFailure(
        runId,
        `scripting: ${e.message}`,
      );
    }
  }
}

async function readMcpPayloadWithRetry(
  client: ReturnType<SupabaseService['getClient']>,
  runId: string,
): Promise<{ metadata: any } | null> {
  const delays = [0, 100, 200, 400, 800];
  for (const delay of delays) {
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    const { data, error } = await client
      .from('content_assets')
      .select('metadata')
      .eq('run_id', runId)
      .eq('kind', 'mcp_payload')
      .order('created_at', { ascending: false })
      .limit(1);
    console.log(
      `[readMcpPayloadWithRetry] runId=${runId} delay=${delay}ms data.length=${data?.length ?? 'null'} error=${error?.message ?? 'none'}`,
    );
    if (data && data.length > 0) return data[0] as { metadata: any };
  }
  return null;
}
