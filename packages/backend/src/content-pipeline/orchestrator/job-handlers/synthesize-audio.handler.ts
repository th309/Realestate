import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service';
import { RunOrchestratorService } from '../run-orchestrator.service';
import { ScriptRepairService } from '../script-repair.service';
import { TTSDriverFactory } from '../../drivers/tts-driver.factory';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { probeAudioDurationMs } from './audio-duration-probe';
import {
  synthesizeWithFallback,
  captureNativeCaptions,
} from './synthesize-audio-chain';

@Injectable()
export class SynthesizeAudioHandler {
  private readonly logger = new Logger(SynthesizeAudioHandler.name);

  constructor(
    private readonly orchestrator: RunOrchestratorService,
    private readonly scriptRepair: ScriptRepairService,
    private readonly ttsFactory: TTSDriverFactory,
    private readonly supabase: SupabaseService,
  ) {}

  async handle(runId: string): Promise<void> {
    this.logger.log(`[PIPE] synthesize-audio.handle START run=${runId}`);
    try {
      const client = this.supabase.getClient();
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
      // Substitute the {{SHORT_LINK}} template placeholder with the voice-
      // friendly spelling of the brand domain. The placeholder pattern is
      // preserved in the stored script (review UI shows the template) and
      // in brand-voice-linter's LLM judge input — only the audio-bound text
      // gets the concrete phrase. The spelling "Property IQ dot app" coaxes
      // Edge TTS to pronounce the mark and TLD as separate, readable tokens
      // rather than mangling "propertyiq.app" into one slurred syllable.
      // Visual short-link overlays (with per-run slugs) live on the video-
      // composition side and use the compact "propertyiq.app" form.
      const spokenText = script.fullText.replace(
        /\{\{SHORT_LINK\}\}/g,
        'Property IQ dot app',
      );
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
      const { driver, result } = await synthesizeWithFallback(
        client,
        this.logger,
        runId,
        chain,
        voice.provider_voice_id as string,
        spokenText,
        outputPath,
      );
      // TTSSynthesisResult.durationMs is wall-clock synth time on edge-tts,
      // not audio length — probe the file directly so we know what'll
      // actually mix into the video.
      const audioDurationMs = await probeAudioDurationMs(outputPath);
      this.logger.log(
        `[PIPE] synthesize-audio run=${runId} driver=${driver.constructor.name} wallMs=${result.durationMs} audioMs=${audioDurationMs} budgetMs=${audioBudgetMs} cost=$${result.cost.amount_usd.toFixed(4)}`,
      );

      if (audioDurationMs > audioBudgetMs) {
        const overSec = (audioDurationMs - audioBudgetMs) / 1000;
        const overSecStr = overSec.toFixed(1);
        const audioSecStr = (audioDurationMs / 1000).toFixed(1);
        const capSecStr = (audioBudgetMs / 1000).toFixed(1);
        // Approximate words to cut at ~140 wpm narration pace.
        const cutWords = Math.max(1, Math.ceil(overSec * (140 / 60)));

        const overflowMessage = `voice-over is ${audioSecStr}s but ${run.format} video is ${fmt.duration_seconds}s with a ${fmt.audio_buffer_seconds}s buffer (cap ${capSecStr}s). Over by ${overSecStr}s.`;

        // Try the script-repair loop first — same mechanism as gate_b_voice.
        // The script generator gets the overflow as feedback and produces a
        // shorter script that fits the budget on retry.
        const repairing = await this.scriptRepair.attemptRepair(
          runId,
          'audio_duration',
          [
            {
              quote:
                spokenText.length > 240
                  ? `${spokenText.slice(0, 240)}…`
                  : spokenText,
              issue: `${overflowMessage} Cut at least ${cutWords} words from the script — favor tightening the hook and outro before touching the row VOs. Row count and rank order MUST be preserved.`,
            },
          ],
        );
        if (repairing) {
          this.logger.warn(
            `[PIPE] synthesize-audio run=${runId} over budget by ${overSecStr}s — repair-loop triggered`,
          );
          return;
        }

        // Repair budget exhausted — fall through to failed with the original
        // descriptive message so the operator can see what happened.
        throw new Error(
          `${overflowMessage} Edit the script to be shorter and retry.`,
        );
      }

      const storageUrl = await this.uploadToStorage(runId, outputPath);
      this.logger.log(
        `[PIPE] synthesize-audio run=${runId} uploaded=${storageUrl}`,
      );

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
        },
      });

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
