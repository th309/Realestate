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
import { buildLongFormRenderPlan } from '../../render/long-form-render-plan';

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
    // Distinct fingerprint so we can prove the discriminated-union-aware
    // build is the one actually executing. If runs ever stop showing
    // BUILD=ranking-aware-v3 in logs, the watch/reload pipeline broke.
    this.logger.log(
      `[PIPE] render-video.handle START run=${runId} BUILD=ranking-aware-v3`,
    );
    try {
      const client = this.supabase.getClient();
      const { data: run } = await client
        .from('content_runs')
        .select('format, resolved_geo, hook_variants')
        .eq('id', runId)
        .single();
      if (!run) throw new Error('run not found');
      this.logger.log(
        `[PIPE] render-video run=${runId} db: format=${run.format} resolved_geo=${JSON.stringify(run.resolved_geo)}`,
      );

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

      let longFormRenderPlan: ReturnType<
        typeof buildLongFormRenderPlan
      > | null = null;
      if (
        run.format === 'long_form_deep_dive' &&
        captionWords &&
        captionWords.length > 0
      ) {
        const { data: scriptRows } = await client
          .from('content_assets')
          .select('metadata')
          .eq('run_id', runId)
          .eq('kind', 'script')
          .order('created_at', { ascending: false })
          .limit(1);
        const scriptsRaw = scriptRows?.[0]?.metadata?.scripts;
        const script = Array.isArray(scriptsRaw) ? scriptsRaw[0] : undefined;
        const fullText =
          script && typeof script.fullText === 'string' ? script.fullText : '';
        const sceneBreakdown = script?.sceneBreakdown;
        if (
          fullText.length > 0 &&
          Array.isArray(sceneBreakdown) &&
          sceneBreakdown.length >= 5
        ) {
          longFormRenderPlan = buildLongFormRenderPlan({
            fullText,
            sceneBreakdown: sceneBreakdown as Array<{
              sceneKey: string;
              text: string;
            }>,
            captionWords,
          });
        }
      }

      const videoPath = join(tmpdir(), `video-${runId}.mp4`);
      this.logger.log(
        `[PIPE] render-video run=${runId} audioUrl=<signed> outputPath=${videoPath} format=${run.format}`,
      );
      this.logger.log(
        `[PIPE] render-video run=${runId} dataBundle.score=${JSON.stringify(payload.metadata?.score)}`,
      );

      // Ranking formats (top_10_ranking / bottom_10_ranking) have no single
      // resolved market — they carry the N-market list on `params`, which
      // Top10Layout reads. Non-ranking formats keep the existing
      // `resolvedMarket` + `dataBundle` shape that GradeReveal/ScoreMover/etc.
      // expect. fetch-data.handler already wrote the ranking bundle into
      // mcp_payload.metadata, so for ranking we forward it as `params`.
      const isRanking =
        run.format === 'top_10_ranking' || run.format === 'bottom_10_ranking';
      this.logger.log(
        `[PIPE] render-video run=${runId} branch: isRanking=${isRanking} format=${run.format}`,
      );
      const formatProps = isRanking
        ? {
            format: run.format,
            params: payload.metadata,
            dataBundle: payload.metadata,
            ctaUrl: '',
            audioUrl: audioSigned.url,
            ...(captionWords && captionWords.length > 0
              ? { captionWords }
              : {}),
          }
        : {
            format: run.format,
            resolvedMarket: run.resolved_geo,
            dataBundle: payload.metadata,
            ctaUrl: '',
            audioUrl: audioSigned.url,
            ...(captionWords && captionWords.length > 0
              ? { captionWords }
              : {}),
            ...(longFormRenderPlan
              ? { longFormRenderPlan }
              : {}),
          };
      this.logger.log(
        `[PIPE] render-video run=${runId} props.keys=[${Object.keys(formatProps).join(',')}] hasResolvedMarket=${'resolvedMarket' in formatProps} hasParams=${'params' in formatProps}`,
      );
      // Full props serialization log — first 600 chars so we can compare to
      // what the subprocess actually validates against. If the renderer says
      // it received resolvedMarket but this log shows none, the wire path
      // (interface → driver → spawn) is mutating the payload.
      const propsJson = JSON.stringify(formatProps);
      const propsPreview = propsJson.slice(0, 600);
      this.logger.log(
        `[PIPE] render-video run=${runId} props.preview=${propsPreview}`,
      );

      // Persist the diagnostic shape to content_run_events so the operator
      // (and future me, reading via Supabase MCP) can audit exactly what
      // shape the renderer subprocess received. Keeps us from depending on
      // backend-stdout tailing to debug schema mismatches.
      await client.from('content_run_events').insert({
        run_id: runId,
        event_type: 'render_video_debug',
        payload: {
          build: 'ranking-aware-v3',
          format: run.format,
          resolved_geo: run.resolved_geo,
          isRanking,
          has_resolvedMarket: 'resolvedMarket' in formatProps,
          has_params: 'params' in formatProps,
          props_keys: Object.keys(formatProps),
          props_preview: propsPreview,
          props_total_bytes: propsJson.length,
        },
      });

      let lastProgressEventAt = 0;
      const PROGRESS_EVENT_MIN_MS = 15_000;

      const result = await this.renderer.render({
        format: run.format,
        props: formatProps,
        outputPath: videoPath,
        onRenderProgress: async (p) => {
          const now = Date.now();
          if (
            now - lastProgressEventAt < PROGRESS_EVENT_MIN_MS &&
            p.renderedFrames > 0 &&
            p.renderedFrames < p.durationInFrames
          ) {
            return;
          }
          lastProgressEventAt = now;
          try {
            await client.from('content_run_events').insert({
              run_id: runId,
              event_type: 'render_video_progress',
              payload: {
                progress: p.progress ?? null,
                rendered_frames: p.renderedFrames,
                encoded_frames: p.encodedFrames,
                duration_in_frames: p.durationInFrames,
                stitch_stage: p.stitchStage ?? null,
                wall_ms: p.wallMs,
              },
            });
          } catch (progressErr) {
            this.logger.warn(
              `[PIPE] render-video progress event insert failed run=${runId}: ${(progressErr as Error).message?.slice(0, 120)}`,
            );
          }
        },
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

      // Diagnostic: capture render output stats so I can audit success-path
      // duration / wall-time without tailing stdout. The render_video_debug
      // event already captured props going INTO the renderer; this captures
      // what came OUT.
      await client.from('content_run_events').insert({
        run_id: runId,
        event_type: 'render_video_done',
        payload: {
          format: run.format,
          duration_ms: result.durationMs,
          render_wall_ms: result.renderWallMs,
          storage_url: storageUrl,
          cost_usd: result.cost?.amount_usd ?? 0,
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
