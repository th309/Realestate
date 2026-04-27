import { Injectable, Inject, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service';
import { RunOrchestratorService } from '../run-orchestrator.service';
import {
  CAPTION_TIMER,
  CaptionTimer,
} from '../../drivers/caption-timer.interface';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeFileSync } from 'fs';
import { randomBytes } from 'crypto';

@Injectable()
export class TimeCaptionsHandler {
  private readonly logger = new Logger(TimeCaptionsHandler.name);

  constructor(
    private readonly orchestrator: RunOrchestratorService,
    @Inject(CAPTION_TIMER) private readonly timer: CaptionTimer,
    private readonly supabase: SupabaseService,
  ) {}

  async handle(runId: string): Promise<void> {
    this.logger.log(`[PIPE] time-captions.handle START run=${runId}`);
    try {
      const client = this.supabase.getClient();

      // Idempotency / native-captions short-circuit: if synthesize-audio
      // already wrote captions_timings (Edge native or Azure-via-Edge-shadow),
      // we skip the Whisper transcription pass entirely. Whisper API is only
      // billed for OpenAI-fallback runs that didn't get native timings.
      const { data: existing } = await client
        .from('content_assets')
        .select('metadata')
        .eq('run_id', runId)
        .eq('kind', 'captions_timings')
        .maybeSingle();
      if (existing?.metadata) {
        const wordCount = Array.isArray(
          (existing.metadata as { words?: unknown[] })?.words,
        )
          ? (existing.metadata as { words: unknown[] }).words.length
          : 0;
        const source =
          (existing.metadata as { source?: string })?.source ?? 'unknown';
        this.logger.log(
          `[PIPE] time-captions.handle SKIP run=${runId} — captions_timings already populated by ${source} (${wordCount} words)`,
        );
        await client.from('content_run_events').insert({
          run_id: runId,
          event_type: 'time_captions_done',
          payload: {
            source,
            word_count: wordCount,
            whisper_called: false,
          },
        });
        await this.orchestrator.handleStepSuccess(runId);
        return;
      }

      const { data: audio } = await client
        .from('content_assets')
        .select('storage_url')
        .eq('run_id', runId)
        .eq('kind', 'audio')
        .single();
      if (!audio) throw new Error('audio asset not found');

      const audioPath = await this.downloadAudio(audio.storage_url);
      const result = await this.timer.time(audioPath);
      this.logger.log(
        `[PIPE] time-captions run=${runId} words=${result.words.length} segments=${result.segments.length} cost=$${result.cost.amount_usd.toFixed(4)}`,
      );

      // Idempotent: clear any prior caption assets so a retry doesn't duplicate.
      await client
        .from('content_assets')
        .delete()
        .eq('run_id', runId)
        .in('kind', ['captions_timings', 'captions_srt']);

      await client.from('content_assets').insert([
        {
          run_id: runId,
          kind: 'captions_timings',
          storage_url: 'inline',
          metadata: {
            words: result.words,
            segments: result.segments,
            source: 'whisper',
          },
        },
        {
          run_id: runId,
          kind: 'captions_srt',
          storage_url: 'inline',
          metadata: { srt: result.srt },
        },
      ]);

      await client.from('content_run_events').insert({
        run_id: runId,
        event_type: 'time_captions_done',
        payload: {
          source: 'whisper',
          word_count: result.words.length,
          whisper_called: true,
          cost_usd: Number(result.cost.amount_usd.toFixed(6)),
        },
      });

      this.logger.log(`[PIPE] time-captions.handle SUCCESS run=${runId}`);
      await this.orchestrator.handleStepSuccess(runId);
    } catch (err) {
      this.logger.error(
        `[PIPE] time-captions FAILED run=${runId}: ${(err as Error).message?.slice(0, 200)}`,
      );
      await this.orchestrator.handleStepFailure(
        runId,
        `timing_captions: ${(err as Error).message}`,
      );
    }
  }

  private async downloadAudio(storageUrl: string): Promise<string> {
    const match = storageUrl.match(/^supabase:\/\/([^/]+)\/(.+)$/);
    if (!match) throw new Error(`unexpected storage_url shape: ${storageUrl}`);
    const { data, error } = await this.supabase
      .getClient()
      .storage.from(match[1])
      .download(match[2]);
    if (error || !data)
      throw new Error(`download failed: ${error?.message ?? 'no data'}`);
    const localPath = join(
      tmpdir(),
      `captions-audio-${randomBytes(4).toString('hex')}.mp3`,
    );
    writeFileSync(localPath, Buffer.from(await data.arrayBuffer()));
    return localPath;
  }
}
