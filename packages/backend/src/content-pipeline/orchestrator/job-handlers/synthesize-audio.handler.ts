import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service';
import { RunOrchestratorService } from '../run-orchestrator.service';
import { TTSDriverFactory } from '../../drivers/tts-driver.factory';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomBytes } from 'crypto';

@Injectable()
export class SynthesizeAudioHandler {
  constructor(
    private readonly orchestrator: RunOrchestratorService,
    private readonly ttsFactory: TTSDriverFactory,
    private readonly supabase: SupabaseService,
  ) {}

  async handle(runId: string): Promise<void> {
    try {
      const client = this.supabase.getClient();
      const { data: run } = await client
        .from('content_runs')
        .select('tts_provider, tts_voice_id')
        .eq('id', runId)
        .single();
      if (!run) throw new Error('run not found');

      const { data: scriptAsset } = await client
        .from('content_assets')
        .select('metadata')
        .eq('run_id', runId)
        .eq('kind', 'script')
        .single();
      if (!scriptAsset) throw new Error('script asset not found');

      const script = scriptAsset.metadata.scripts[0];
      const driver = this.ttsFactory.forProvider(run.tts_provider);
      // Resolve the internal voice id (e.g. 'edge-andrew') to the provider's
      // canonical voice name (e.g. 'en-US-AndrewMultilingualNeural'). The
      // TTS driver expects the provider-specific name, not our internal id.
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
      const result = await driver.synthesize({
        text: script.fullText,
        voiceId: voice.provider_voice_id,
        outputPath,
        format: 'mp3',
      });

      const storageUrl = await this.uploadToStorage(runId, outputPath);

      await client.from('content_assets').insert({
        run_id: runId,
        kind: 'audio',
        storage_url: storageUrl,
        metadata: { durationMs: result.durationMs, bitrate: result.bitrate },
      });

      await this.orchestrator.handleStepSuccess(runId);
    } catch (err) {
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
