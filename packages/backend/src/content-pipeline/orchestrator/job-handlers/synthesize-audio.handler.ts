import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service';
import { RunOrchestratorService } from '../run-orchestrator.service';
import { TTSDriverFactory } from '../../drivers/tts-driver.factory';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

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
        .select('tts_provider, tts_voice_id')
        .eq('id', runId)
        .single();
      if (!run) throw new Error('run not found');
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
      const driver = this.ttsFactory.forProvider(run.tts_provider);
      this.logger.log(
        `[PIPE] synthesize-audio run=${runId} driver=${driver.constructor.name} script.len=${script.fullText.length}`,
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
        text: script.fullText,
        voiceId: voice.provider_voice_id,
        outputPath,
        format: 'mp3',
      });
      this.logger.log(
        `[PIPE] synthesize-audio run=${runId} driver=${driver.constructor.name} wallMs=${result.durationMs} cost=$${result.cost.amount_usd.toFixed(4)}`,
      );

      const storageUrl = await this.uploadToStorage(runId, outputPath);
      this.logger.log(
        `[PIPE] synthesize-audio run=${runId} uploaded=${storageUrl}`,
      );

      await client.from('content_assets').insert({
        run_id: runId,
        kind: 'audio',
        storage_url: storageUrl,
        metadata: { durationMs: result.durationMs, bitrate: result.bitrate },
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
