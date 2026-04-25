import { Injectable, Inject, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service';
import { RunOrchestratorService } from '../run-orchestrator.service';
import { QueueService } from '../queue.service';
import {
  VIDEO_RENDERER,
  VideoRenderer,
} from '../../drivers/video-renderer.interface';
import { getAssetSignedUrl } from '../../asset-signing';
import { join } from 'path';
import { tmpdir } from 'os';
import { readFileSync } from 'fs';

@Injectable()
export class RenderVideoHandler {
  private readonly logger = new Logger(RenderVideoHandler.name);

  constructor(
    private readonly orchestrator: RunOrchestratorService,
    @Inject(VIDEO_RENDERER) private readonly renderer: VideoRenderer,
    private readonly supabase: SupabaseService,
    private readonly queue: QueueService,
  ) {}

  async handle(runId: string): Promise<void> {
    this.logger.log(`[PIPE] render-video.handle START run=${runId}`);
    try {
      const client = this.supabase.getClient();
      const { data: run } = await client
        .from('content_runs')
        .select('format, resolved_geo, hook_variants')
        .eq('id', runId)
        .single();
      if (!run) throw new Error('run not found');

      const { data: payload } = await client
        .from('content_assets')
        .select('metadata')
        .eq('run_id', runId)
        .eq('kind', 'mcp_payload')
        .single();
      if (!payload) throw new Error('mcp_payload asset not found');

      // Voiceover travels into the Remotion composition via a signed URL —
      // the compositor's <Audio> component fetches it and mixes natively,
      // so there's no download-to-tmp or ffmpeg post-mux step.
      const audioSigned = await getAssetSignedUrl(client, runId, 'audio');
      if (!audioSigned) throw new Error('audio asset not found');

      // captions_timings is optional — only present when CAPTIONS_ENABLED=true
      // and the timing_captions step ran. maybeSingle() returns { data: null }
      // (no error) when no row exists, so this gracefully no-ops otherwise.
      const { data: captionsAsset } = await client
        .from('content_assets')
        .select('metadata')
        .eq('run_id', runId)
        .eq('kind', 'captions_timings')
        .maybeSingle();
      const captionWords = captionsAsset?.metadata?.words as
        | Array<{ startMs: number; endMs: number; word: string }>
        | undefined;

      const videoPath = join(tmpdir(), `video-${runId}.mp4`);
      this.logger.log(
        `[PIPE] render-video run=${runId} audioUrl=<signed> outputPath=${videoPath} format=${run.format}`,
      );
      this.logger.log(
        `[PIPE] render-video run=${runId} dataBundle.score=${JSON.stringify(payload.metadata?.score)}`,
      );

      const result = await this.renderer.render({
        format: run.format,
        props: {
          format: run.format,
          resolvedMarket: run.resolved_geo,
          dataBundle: payload.metadata,
          ctaUrl: '',
          audioUrl: audioSigned.url,
          ...(captionWords && captionWords.length > 0 ? { captionWords } : {}),
        },
        outputPath: videoPath,
      });
      this.logger.log(
        `[PIPE] render-video run=${runId} result.videoPath=${result.videoPath} durationMs=${result.durationMs} renderWallMs=${result.renderWallMs}`,
      );

      const storageUrl = await this.uploadToStorage(runId, result.videoPath);
      this.logger.log(
        `[PIPE] render-video run=${runId} uploaded=${storageUrl}`,
      );
      // Idempotent write: clear any prior video_master row so a retry doesn't
      // leave duplicate rows that break downstream .single() reads.
      await client
        .from('content_assets')
        .delete()
        .eq('run_id', runId)
        .eq('kind', 'video_master');
      await client.from('content_assets').insert({
        run_id: runId,
        kind: 'video_master',
        storage_url: storageUrl,
        metadata: {
          durationMs: result.durationMs,
          renderWallMs: result.renderWallMs,
        },
      });

      this.logger.log(`[PIPE] render-video.handle SUCCESS run=${runId}`);
      await this.orchestrator.handleStepSuccess(runId);

      // Fire-and-forget thumbnail render. The thumbnail is a side-channel
      // asset (used by the review UI and future YouTube custom-thumbnail
      // uploads); failures here MUST NOT fail the run, so we catch enqueue
      // errors and let RenderThumbnailHandler write its own
      // thumbnail_render_failed content_run_event if the spawn itself fails.
      try {
        await this.queue.send('render-thumbnail', { runId });
        this.logger.log(`[PIPE] render-video run=${runId} enqueued thumbnail`);
      } catch (enqueueErr) {
        this.logger.warn(
          `[PIPE] render-video run=${runId} thumbnail enqueue failed (non-fatal): ${(enqueueErr as Error).message?.slice(0, 200)}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `[PIPE] render-video FAILED run=${runId}: ${(err as Error).message?.slice(0, 200)}`,
      );
      await this.orchestrator.handleStepFailure(
        runId,
        `rendering_video: ${(err as Error).message}`,
      );
    }
  }

  private async uploadToStorage(
    runId: string,
    localPath: string,
  ): Promise<string> {
    const client = this.supabase.getClient();
    const buffer = readFileSync(localPath);
    const path = `runs/${runId}/video.mp4`;
    const { error } = await client.storage
      .from('content-pipeline')
      .upload(path, buffer, {
        contentType: 'video/mp4',
        upsert: true,
      });
    if (error) throw error;
    return `supabase://content-pipeline/${path}`;
  }
}
