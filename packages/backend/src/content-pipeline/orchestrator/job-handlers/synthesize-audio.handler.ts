import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service';
import { RunOrchestratorService } from '../run-orchestrator.service';
import { ScriptRepairService } from '../script-repair.service';
import { TTSDriverFactory } from '../../drivers/tts-driver.factory';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { probeAudioDurationMs } from './audio-duration-probe';
import { toSpokenText } from './narration-segmenter';
import { captureNativeCaptions } from './synthesize-audio-chain';
import {
  synthesizeNarration,
  totalSilenceMs,
} from './synthesize-narration-segmented';
import { enforceAudioBudget } from './enforce-audio-budget';
import { AlertDispatcherService } from '../../observability/alert-dispatcher.service';
import { CostCapService } from '../../auto-ideation/cost-cap.service';
import { recordDriverSpend } from './record-driver-spend';
import {
  captureScriptRevision,
  isStepStaleAfterScriptEdit,
} from './stale-script-revision-guard';

@Injectable()
export class SynthesizeAudioHandler {
  private readonly logger = new Logger(SynthesizeAudioHandler.name);

  constructor(
    private readonly orchestrator: RunOrchestratorService,
    private readonly scriptRepair: ScriptRepairService,
    private readonly ttsFactory: TTSDriverFactory,
    private readonly supabase: SupabaseService,
    private readonly alerts: AlertDispatcherService,
    private readonly costCap: CostCapService,
  ) {}

  async handle(runId: string): Promise<void> {
    this.logger.log(`[PIPE] synthesize-audio.handle START run=${runId}`);
    try {
      const client = this.supabase.getClient();
      // TTS is budgeted 180s — the widest edit window in the pipeline, and the
      // one the script_revision column was added for.
      const capturedRevision = await captureScriptRevision(client, runId);
      const { data: run } = await client
        .from('content_runs')
        .select('format, tts_provider, tts_voice_id')
        .eq('id', runId)
        .single();
      if (!run) throw new Error('run not found');

      const { data: fmt } = await client
        .from('format_templates')
        .select('duration_seconds, audio_buffer_seconds')
        .eq('format', run.format)
        .single();
      if (!fmt) throw new Error(`format_template not found for ${run.format}`);
      const audioBudgetMs =
        (fmt.duration_seconds - fmt.audio_buffer_seconds) * 1000;
      this.logger.log(
        `[PIPE] synthesize-audio run=${runId} provider=${run.tts_provider} voice=${run.tts_voice_id}`,
      );

      const { data: scriptAsset } = await client
        .from('content_assets')
        .select('metadata')
        .eq('run_id', runId)
        .eq('kind', 'script')
        .single();
      if (!scriptAsset) throw new Error('script asset not found');

      const script = scriptAsset.metadata.scripts[0];
      // Substitution lives in the shared narration module so the admin script
      // editor's duration meter costs the same words this does — the token is
      // one word stored but four spoken, and it ends nearly every script.
      //
      // Original note, still accurate: substitute the {{SHORT_LINK}} template
      // placeholder with the voice-
      // friendly spelling of the brand domain. The placeholder pattern is
      // preserved in the stored script (review UI shows the template) and
      // in brand-voice-linter's LLM judge input — only the audio-bound text
      // gets the concrete phrase. The spelling "Property IQ dot app" coaxes
      // Edge TTS to pronounce the mark and TLD as separate, readable tokens
      // rather than mangling "propertyiq.app" into one slurred syllable.
      // Visual short-link overlays (with per-run slugs) live on the video-
      // composition side and use the compact "propertyiq.app" form.
      const spokenText = toSpokenText(script.fullText);
      const chain = this.ttsFactory
        .driverChain(run.tts_provider)
        .filter((d) => d.isConfigured());
      if (chain.length === 0) {
        throw new Error(
          `No TTS driver configured for provider='${run.tts_provider}'`,
        );
      }
      this.logger.log(
        `[PIPE] synthesize-audio run=${runId} chain=[${chain.map((d) => d.constructor.name).join(',')}] script.len=${script.fullText.length} spoken.len=${spokenText.length}`,
      );

      const { data: voice } = await client
        .from('tts_voices')
        .select('provider_voice_id')
        .eq('id', run.tts_voice_id)
        .single();
      if (!voice)
        throw new Error(`voice ${run.tts_voice_id} not found in tts_voices`);

      const outputPath = join(
        tmpdir(),
        `audio-${runId}-${randomBytes(4).toString('hex')}.mp3`,
      );
      const { driver, result, segmentPlan, loudnorm } =
        await synthesizeNarration(
          client,
          this.logger,
          runId,
          chain,
          voice.provider_voice_id as string,
          spokenText,
          outputPath,
        );
      const segmentCount = segmentPlan?.segments.length ?? 1;
      const silenceMs = segmentPlan ? totalSilenceMs(segmentPlan.segments) : 0;
      // TTSSynthesisResult.durationMs is wall-clock synth time on edge-tts,
      // not audio length — probe the file directly so we know what'll
      // actually mix into the video.
      const audioDurationMs = await probeAudioDurationMs(outputPath);
      this.logger.log(
        `[PIPE] synthesize-audio run=${runId} driver=${driver.constructor.name} segments=${segmentCount} silenceMs=${silenceMs} wallMs=${result.durationMs} audioMs=${audioDurationMs} budgetMs=${audioBudgetMs} cost=$${result.cost.amount_usd.toFixed(4)}`,
      );

      // Terminal-write boundary — placed before enforceAudioBudget because
      // that is the first thing that can act on the run: it transitions back
      // to `scripting` on overflow. Below it the storage upload replaces the
      // run's audio asset, so a stale worker finishing after the restart's
      // worker would overwrite good narration with narration of deleted text.
      const stale = await isStepStaleAfterScriptEdit(client, this.logger, {
        runId,
        step: 'rendering_voice',
        capturedRevision,
      });
      if (stale) return;

      const repairing = await enforceAudioBudget(
        this.scriptRepair,
        this.logger,
        {
          runId,
          format: run.format,
          spokenText,
          audioDurationMs,
          audioBudgetMs,
          durationSeconds: fmt.duration_seconds,
          audioBufferSeconds: fmt.audio_buffer_seconds,
        },
      );
      if (repairing) return;

      const storageUrl = await this.uploadToStorage(runId, outputPath);
      this.logger.log(
        `[PIPE] synthesize-audio run=${runId} uploaded=${storageUrl}`,
      );

      // Phase 4.13: audio/script duration mismatch warning (estimate at 150 wpm).
      const expectedDurationMs =
        (spokenText.split(/\s+/).filter(Boolean).length / 150) * 60_000;
      const actualDurationMs = audioDurationMs;
      const deltaPct =
        expectedDurationMs > 0
          ? Math.abs(actualDurationMs - expectedDurationMs) / expectedDurationMs
          : 0;
      if (deltaPct > 0.2) {
        await client.from('content_run_events').insert({
          run_id: runId,
          event_type: 'audio_length_mismatch',
          payload: { expectedDurationMs, actualDurationMs, deltaPct },
        });
        await this.alerts.sendAlert(
          'warn',
          'audio_length_mismatch',
          `Run ${runId} audio duration differs from script estimate by ${(
            deltaPct * 100
          ).toFixed(0)}%.`,
          { runId, deltaPct, expectedDurationMs, actualDurationMs },
        );
      }

      // Idempotent write: clear any prior audio row so .single() reads stay valid after a retry.
      await client
        .from('content_assets')
        .delete()
        .eq('run_id', runId)
        .eq('kind', 'audio');
      await client.from('content_assets').insert({
        run_id: runId,
        kind: 'audio',
        storage_url: storageUrl,
        metadata: {
          durationMs: audioDurationMs,
          synthWallMs: result.durationMs,
          bitrate: result.bitrate,
          segments: segmentCount,
          loudnorm,
        },
      });

      // Native captions chain (Edge native → Azure-via-Edge-shadow → Whisper).
      // Persists captions_timings when native data is available so the
      // downstream time-captions step is a no-op for Edge/Azure runs.
      const captions = await captureNativeCaptions(
        client,
        this.logger,
        runId,
        driver,
        chain,
        voice.provider_voice_id as string,
        spokenText,
        result.wordTimings,
        segmentPlan,
      );

      // Diagnostic event so I can audit audio-vs-budget on success runs
      // without tailing stdout. The repair-loop fires only on overflow; this
      // captures the under-budget case too (ratio < 1.0).
      const overageMs = audioDurationMs - audioBudgetMs;
      await client.from('content_run_events').insert({
        run_id: runId,
        event_type: 'synthesize_audio_done',
        payload: {
          format: run.format,
          driver: driver.constructor.name,
          provider: run.tts_provider,
          voice_id: run.tts_voice_id,
          audio_ms: audioDurationMs,
          budget_ms: audioBudgetMs,
          overage_ms: overageMs,
          ratio: Number((audioDurationMs / audioBudgetMs).toFixed(3)),
          synth_wall_ms: result.durationMs,
          bitrate: result.bitrate,
          cost_usd: Number(result.cost.amount_usd.toFixed(6)),
          spoken_chars: spokenText.length,
          spoken_words: spokenText.split(/\s+/).filter(Boolean).length,
          captions_source: captions.source,
          captions_word_count: captions.count,
          segments: segmentCount,
          loudnorm,
          // Inserted pause time — it counts against the audio budget, so this
          // is the first thing to look at if runs start overflowing.
          silence_ms: silenceMs,
        },
      });

      // Edge TTS bills $0 and is skipped; Azure/OpenAI voices are charged.
      await recordDriverSpend(
        this.costCap,
        this.logger,
        'synthesize-audio',
        runId,
        result.cost,
      );

      this.logger.log(`[PIPE] synthesize-audio.handle SUCCESS run=${runId}`);
      await this.orchestrator.handleStepSuccess(runId);
    } catch (err) {
      this.logger.error(
        `[PIPE] synthesize-audio FAILED run=${runId}: ${(err as Error).message?.slice(0, 200)}`,
      );
      await this.orchestrator.handleStepFailure(
        runId,
        `rendering_voice: ${(err as Error).message}`,
      );
    }
  }

  private async uploadToStorage(
    runId: string,
    localPath: string,
  ): Promise<string> {
    const client = this.supabase.getClient();
    const { readFileSync } = await import('fs');
    const buffer = readFileSync(localPath);
    const path = `runs/${runId}/audio.mp3`;
    const { error } = await client.storage
      .from('content-pipeline')
      .upload(path, buffer, {
        contentType: 'audio/mpeg',
        upsert: true,
      });
    if (error) throw error;
    return `supabase://content-pipeline/${path}`;
  }
}
