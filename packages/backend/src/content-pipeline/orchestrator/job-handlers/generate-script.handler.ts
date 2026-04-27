import { Injectable, Inject, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service';
import { RunOrchestratorService } from '../run-orchestrator.service';
import {
  SCRIPT_GENERATOR,
  ScriptGenerator,
} from '../../drivers/script-generator.interface';

@Injectable()
export class GenerateScriptHandler {
  private readonly logger = new Logger(GenerateScriptHandler.name);

  constructor(
    private readonly orchestrator: RunOrchestratorService,
    @Inject(SCRIPT_GENERATOR) private readonly scriptGen: ScriptGenerator,
    private readonly supabase: SupabaseService,
  ) {}

  async handle(runId: string): Promise<void> {
    try {
      this.logger.log(`[PIPE] generate-script.handle START run=${runId}`);
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

      this.logger.log(
        `[PIPE] generate-script budgets run=${runId} format=${run.format} duration_sec=${fmt.duration_seconds} audio_budget_sec=${audioBudgetSeconds} buffer_sec=${fmt.audio_buffer_seconds} natural_wpm=${fmt.natural_wpm} word_budget=${wordBudget}`,
      );

      const payload = await readMcpPayloadWithRetry(client, runId);
      if (!payload)
        throw new Error(
          'mcp_payload asset not found after retries (fetch-data did not persist it)',
        );

      const metaKeys =
        payload.metadata && typeof payload.metadata === 'object'
          ? Object.keys(payload.metadata as object)
          : [];
      this.logger.log(
        `[PIPE] generate-script mcp_payload run=${runId} metadataKeys=${metaKeys.join(',')}`,
      );

      const geo = run.resolved_geo as { canonical_name?: string } | null;
      this.logger.log(
        `[PIPE] generate-script resolved_geo run=${runId} has_geo=${Boolean(geo)} canonical_name=${geo?.canonical_name ?? 'MISSING'}`,
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

      if (!result.scripts?.length) {
        this.logger.error(
          `[PIPE] generate-script EMPTY_RESULT run=${runId} diagnostics=${JSON.stringify(result.diagnostics ?? {})}`,
        );
        throw new Error(
          'Script generator returned no scripts (see backend logs / generate_script_error event)',
        );
      }

      this.logger.log(
        `[PIPE] generate-script LLM_OK run=${runId} scripts_count=${result.scripts.length} diagnostics=${JSON.stringify(result.diagnostics ?? {})}`,
      );

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
      const firstScript = result.scripts[0]!;
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
          llm_diagnostics: result.diagnostics ?? null,
        },
      });

      this.logger.log(
        `[PIPE] generate-script.handle DONE run=${runId} words=${fullTextWords}`,
      );
      await this.orchestrator.handleStepSuccess(runId);
    } catch (err) {
      const e = err as Error;
      const stackPreview = e.stack?.split('\n').slice(0, 8).join('\n') ?? '';
      this.logger.error(
        `[PIPE] generate-script.handle FAIL run=${runId} msg=${e.message}\n${stackPreview}`,
      );

      let formatHint: string | undefined;
      let approvalHint: string | undefined;
      try {
        const ex = this.supabase.getClient();
        const { data: runRow } = await ex
          .from('content_runs')
          .select('format, approval_mode')
          .eq('id', runId)
          .maybeSingle();
        formatHint = runRow?.format as string | undefined;
        approvalHint = runRow?.approval_mode as string | undefined;
      } catch {
        /* ignore */
      }

      try {
        const client = this.supabase.getClient();
        await client.from('content_run_events').insert({
          run_id: runId,
          event_type: 'generate_script_error',
          payload: {
            message: e.message,
            name: e.name,
            stack_preview: stackPreview.slice(0, 2000),
            format: formatHint ?? null,
            approval_mode: approvalHint ?? null,
          },
        });
      } catch (logErr) {
        this.logger.warn(
          `[PIPE] generate-script could not persist generate_script_error run=${runId} err=${(logErr as Error).message}`,
        );
      }

      await this.orchestrator.handleStepFailure(
        runId,
        `scripting: ${e.message}`,
      );
    }
  }
}

const mcpPayloadLogger = new Logger('readMcpPayloadWithRetry');

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
    mcpPayloadLogger.log(
      `[PIPE] mcp_payload retry runId=${runId} delayMs=${delay} rows=${data?.length ?? 'null'} err=${error?.message ?? 'none'}`,
    );
    if (data && data.length > 0) return data[0] as { metadata: any };
  }
  mcpPayloadLogger.warn(
    `[PIPE] mcp_payload MISS runId=${runId} after ${delays.length} attempts`,
  );
  return null;
}
