import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service';
import { RunOrchestratorService } from '../run-orchestrator.service';
import { TTSDriverFactory } from '../../drivers/tts-driver.factory';
import {
  TTSDriver,
  TTSSynthesisRequest,
  TTSSynthesisResult,
} from '../../drivers/tts-driver.interface';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { probeAudioDurationMs } from './audio-duration-probe';

// When falling through to OpenAI from an Azure/Edge primary, the user's
// stored voiceId is from a different catalog (en-US-JennyNeural, etc.) so we
// override to OpenAI's default voice. Future work could store an OpenAI voice
// mapping per row in tts_voices; out of P2 scope.
const OPENAI_FALLBACK_VOICE = 'alloy';

@Injectable()
export class SynthesizeAudioHandler {
  private readonly logger = new Logger(SynthesizeAudioHandler.name);

  constructor(
    private readonly orchestrator: RunOrchestratorService,
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
      const { driver, result } = await this.synthesizeWithFallback(
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
        const overS = ((audioDurationMs - audioBudgetMs) / 1000).toFixed(1);
        throw new Error(
          `voice-over is ${(audioDurationMs / 1000).toFixed(1)}s but ${run.format} video is ${fmt.duration_seconds}s with a ${fmt.audio_buffer_seconds}s buffer (cap ${(audioBudgetMs / 1000).toFixed(1)}s). Over by ${overS}s. Edit the script to be shorter and retry.`,
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

  /**
   * Walk the priority-ordered driver chain. The first driver is the primary;
   * synthesizeWithRetry handles transient errors against it. On terminal
   * failure (after retries exhausted), advance to the next configured
   * driver, log a tts_fallback content_run_event, and try again. The
   * voiceId is overridden when falling through to OpenAI since its voice
   * catalog is incompatible with Azure/Edge.
   */
  private async synthesizeWithFallback(
    runId: string,
    chain: TTSDriver[],
    primaryVoiceId: string,
    text: string,
    outputPath: string,
  ): Promise<{ driver: TTSDriver; result: TTSSynthesisResult }> {
    const client = this.supabase.getClient();
    let lastErr: Error | null = null;
    for (let i = 0; i < chain.length; i++) {
      const driver = chain[i];
      const voiceId =
        driver.provider === 'openai' && chain[0].provider !== 'openai'
          ? OPENAI_FALLBACK_VOICE
          : primaryVoiceId;
      const req: TTSSynthesisRequest = {
        text,
        voiceId,
        outputPath,
        format: 'mp3',
      };
      try {
        const result = await this.synthesizeWithRetry(driver, req);
        if (i > 0) {
          await client.from('content_run_events').insert({
            run_id: runId,
            event_type: 'tts_fallback',
            payload: {
              from: chain[0].provider,
              to: driver.provider,
              reason: lastErr?.message?.slice(0, 500) ?? null,
            },
          });
          this.logger.warn(
            `[PIPE] synthesize-audio run=${runId} fell back ${chain[0].provider}→${driver.provider}`,
          );
        }
        return { driver, result };
      } catch (err) {
        lastErr = err as Error;
        if (i === chain.length - 1) throw lastErr;
        this.logger.warn(
          `[PIPE] synthesize-audio run=${runId} ${driver.provider} failed terminally, advancing chain: ${lastErr.message?.slice(0, 200)}`,
        );
      }
    }
    throw lastErr ?? new Error('synthesizeWithFallback: empty chain');
  }

  /**
   * Retry TTS on transient failures. Microsoft's edge-tts endpoint returns
   * intermittent WS 403s when a single IP hits it often — those are not
   * permanent errors and retrying after a short delay usually succeeds.
   */
  private async synthesizeWithRetry(
    driver: ReturnType<TTSDriverFactory['forProvider']>,
    req: Parameters<
      ReturnType<TTSDriverFactory['forProvider']>['synthesize']
    >[0],
  ): Promise<
    Awaited<
      ReturnType<ReturnType<TTSDriverFactory['forProvider']>['synthesize']>
    >
  > {
    const delays = [0, 2000, 5000, 10000, 20000];
    let lastErr: Error | null = null;
    for (let i = 0; i < delays.length; i++) {
      if (delays[i] > 0) {
        const jitter = Math.floor(Math.random() * 1000);
        await new Promise((r) => setTimeout(r, delays[i] + jitter));
      }
      try {
        return await driver.synthesize(req);
      } catch (err) {
        lastErr = err as Error;
        const msg = lastErr.message || '';
        const isTransient =
          msg.includes('403') ||
          msg.includes('WSServerHandshakeError') ||
          msg.includes('timeout') ||
          msg.includes('ECONNRESET') ||
          msg.includes('ETIMEDOUT');
        if (!isTransient || i === delays.length - 1) {
          throw lastErr;
        }
        this.logger.warn(
          `TTS attempt ${i + 1}/${delays.length} failed (transient), retrying: ${msg.slice(0, 200)}`,
        );
      }
    }
    throw lastErr ?? new Error('synthesize failed after retries');
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
