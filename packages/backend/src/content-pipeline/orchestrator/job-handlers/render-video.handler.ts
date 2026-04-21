import { Injectable, Inject } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service';
import { RunOrchestratorService } from '../run-orchestrator.service';
import {
  VIDEO_RENDERER,
  VideoRenderer,
} from '../../drivers/video-renderer.interface';
import { join } from 'path';
import { tmpdir } from 'os';
import { readFileSync } from 'fs';

@Injectable()
export class RenderVideoHandler {
  constructor(
    private readonly orchestrator: RunOrchestratorService,
    @Inject(VIDEO_RENDERER) private readonly renderer: VideoRenderer,
    private readonly supabase: SupabaseService,
  ) {}

  async handle(runId: string): Promise<void> {
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

      const { data: audio } = await client
        .from('content_assets')
        .select('storage_url')
        .eq('run_id', runId)
        .eq('kind', 'audio')
        .single();
      if (!audio) throw new Error('audio asset not found');

      const audioPath = await this.downloadFromStorage(audio.storage_url);
      const videoPath = join(tmpdir(), `video-${runId}.mp4`);

      const result = await this.renderer.render({
        format: run.format,
        props: {
          format: run.format,
          resolvedMarket: run.resolved_geo,
          dataBundle: payload.metadata,
          ctaUrl: '',
        },
        outputPath: videoPath,
        audioPath,
      });

      const storageUrl = await this.uploadToStorage(runId, result.videoPath);
      await client.from('content_assets').insert({
        run_id: runId,
        kind: 'video_master',
        storage_url: storageUrl,
        metadata: {
          durationMs: result.durationMs,
          renderWallMs: result.renderWallMs,
        },
      });

      await this.orchestrator.handleStepSuccess(runId);
    } catch (err) {
      await this.orchestrator.handleStepFailure(
        runId,
        `rendering_video: ${(err as Error).message}`,
      );
    }
  }

  private async downloadFromStorage(supabaseUrl: string): Promise<string> {
    const match = supabaseUrl.match(/^supabase:\/\/([^/]+)\/(.+)$/);
    if (!match) throw new Error(`invalid supabase url: ${supabaseUrl}`);
    const [, bucket, path] = match;
    const client = this.supabase.getClient();
    const { data, error } = await client.storage.from(bucket).download(path);
    if (error) throw error;
    if (!data) throw new Error(`no data downloaded from ${supabaseUrl}`);
    const { writeFileSync } = await import('fs');
    const localPath = join(tmpdir(), `dl-${Date.now()}.bin`);
    writeFileSync(localPath, Buffer.from(await data.arrayBuffer()));
    return localPath;
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
