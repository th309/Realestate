import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service';
import { RunOrchestratorService } from '../run-orchestrator.service';
import { TTSDriverFactory } from '../../drivers/tts-driver.factory';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';
import { spawn } from 'child_process';

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
      const driver = this.ttsFactory.forProvider(run.tts_provider);
      this.logger.log(
        `[PIPE] synthesize-audio run=${runId} driver=${driver.constructor.name} script.len=${script.fullText.length} spoken.len=${spokenText.length}`,
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
      const result = await this.synthesizeWithRetry(driver, {
        text: spokenText,
        voiceId: voice.provider_voice_id,
        outputPath,
        format: 'mp3',
      });
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

// Shells out to ffprobe to read the audio file's real duration. ffprobe is
// on PATH in both dev and the Railway container (Remotion depends on it).
function probeAudioDurationMs(path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      path,
    ]);
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (c) => (stdout += c.toString()));
    proc.stderr.on('data', (c) => (stderr += c.toString()));
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`ffprobe exited ${code}: ${stderr.trim()}`));
      }
      const seconds = parseFloat(stdout.trim());
      if (!Number.isFinite(seconds)) {
        return reject(new Error(`ffprobe returned non-numeric: ${stdout}`));
      }
      resolve(Math.round(seconds * 1000));
    });
  });
}
