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
        .select('format, audience, resolved_geo, format_options')
        .eq('id', runId)
        .single();
      if (!run) throw new Error('run not found');

      const { data: fmt } = await client
        .from('format_templates')
        .select('duration_seconds, natural_wpm, audio_buffer_seconds')
        .eq('format', run.format)
        .single();
      if (!fmt) throw new Error(`format_template not found for ${run.format}`);
      const audioBudgetSeconds =
        fmt.duration_seconds - fmt.audio_buffer_seconds;
      const wordBudget = Math.floor(
        (audioBudgetSeconds * fmt.natural_wpm) / 60,
      );

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

      const formatOptions = (run.format_options ?? {}) as {
        windowDays?: number;
        windowLabel?: string;
        priorDate?: string;
        script_repair?: {
          history?: Array<{
            gate: string;
            at?: string;
            violations?: Array<{ quote?: string; issue?: string }>;
          }>;
        };
      };

      // Pass repair-loop feedback through to the script generator. When a
      // prior attempt's gate failed (brand voice today), the orchestrator
      // routed back to scripting with violations persisted on the run; the
      // generator must address them in the new script.
      const priorFeedback = (formatOptions.script_repair?.history ?? []).map(
        (entry) => ({
          gate: entry.gate,
          at: entry.at,
          violations: (entry.violations ?? []).map((v) => ({
            quote: v.quote ?? '',
            issue: v.issue ?? '',
          })),
        }),
      );

      const result = await this.scriptGen.generate({
        format: run.format,
        audience: run.audience,
        resolvedMarket: run.resolved_geo,
        dataBundle: payload.metadata,
        variantCount: 1,
        ctaText: binding?.cta_text ?? 'Get your free Market Snapshot at ',
        videoDurationSeconds: fmt.duration_seconds,
        audioBudgetSeconds,
        wordBudget,
        naturalWpm: fmt.natural_wpm,
        windowLabel: formatOptions.windowLabel,
        priorFeedback: priorFeedback.length > 0 ? priorFeedback : undefined,
      });

      await client
        .from('content_runs')
        .update({
          hook_variants: result.scripts,
          costs: { script: [result.cost] },
        })
        .eq('id', runId);

      // Idempotent write: clear any prior script/script_raw rows first so
      // downstream .single() reads don't blow up after a retry.
      await client
        .from('content_assets')
        .delete()
        .eq('run_id', runId)
        .in('kind', ['script', 'script_raw']);
      await client.from('content_assets').insert([
        {
          run_id: runId,
          kind: 'script',
          storage_url: 'inline',
          // For ranking formats, also persist the structured RankingScript
          // alongside the flattened envelope so render-video and per-platform
          // publishers can compose against the per-row hooks/rows directly.
          metadata: {
            scripts: result.scripts,
            ...(result.ranking ? { ranking: result.ranking } : {}),
          },
        },
        {
          run_id: runId,
          kind: 'script_raw',
          storage_url: 'inline',
          metadata: { raw: result.rawLLMResponse },
        },
      ]);

      // Diagnostic: capture the budget given to the generator + what was
      // actually produced, so audio-overflow vs word-budget calibration can
      // be audited from the DB without tailing backend stdout.
      const firstScript = result.scripts[0];
      const fullTextLen = firstScript?.fullText?.length ?? 0;
      const fullTextWords = firstScript?.fullText
        ? firstScript.fullText.split(/\s+/).filter(Boolean).length
        : 0;
      await client.from('content_run_events').insert({
        run_id: runId,
        event_type: 'generate_script_done',
        payload: {
          format: run.format,
          audio_budget_seconds: audioBudgetSeconds,
          word_budget: wordBudget,
          natural_wpm: fmt.natural_wpm,
          full_text_chars: fullTextLen,
          full_text_words: fullTextWords,
          words_over_budget: fullTextWords - wordBudget,
          scripts_count: result.scripts.length,
          prior_feedback_count: priorFeedback.length,
          repaired_from_gates: priorFeedback.map((f) => f.gate),
          fullText_preview: firstScript?.fullText?.slice(0, 600) ?? '',
        },
      });

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
