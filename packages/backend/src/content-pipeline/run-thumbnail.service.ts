import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { QueueService } from './orchestrator/queue.service';
import { FORMAT_DURATIONS_IN_FRAMES } from './format-durations';
import type { ContentFormat } from './types';

export interface UploadedThumbnail {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

/**
 * Operator-driven thumbnail mutations: regenerate from an arbitrary frame,
 * or upload a custom override image. Split out from RunActionsService to
 * keep that file under the 300-line hard limit and to give thumbnail
 * concerns a single place to grow (e.g. Task 2.28's style variants will
 * extend this surface).
 */
@Injectable()
export class RunThumbnailService {
  private readonly logger = new Logger(RunThumbnailService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly queue: QueueService,
  ) {}

  /**
   * Enqueue a render-thumbnail job at a specific frame for an existing run.
   * Validates the frame is in [0, durationInFrames-1] for the run's format.
   * Render is async; the new content_assets row appears when
   * RenderThumbnailHandler finishes.
   */
  async regenerateThumbnail(runId: string, frame: number): Promise<void> {
    if (!Number.isInteger(frame) || frame < 0) {
      throw new BadRequestException('frame must be a non-negative integer');
    }
    const client = this.supabase.getClient();
    const { data: run, error } = await client
      .from('content_runs')
      .select('format')
      .eq('id', runId)
      .maybeSingle();
    if (error) throw error;
    if (!run) throw new NotFoundException(`run ${runId} not found`);

    const format = run.format as ContentFormat;
    const max = FORMAT_DURATIONS_IN_FRAMES[format];
    if (max === undefined) {
      throw new BadRequestException(
        `unknown format '${format}' — cannot validate frame range`,
      );
    }
    if (frame > max - 1) {
      throw new BadRequestException(
        `frame ${frame} out of range for ${format} (max ${max - 1})`,
      );
    }

    await this.queue.send('render-thumbnail', { runId, frame });
    this.logger.log(`[THUMB] regenerate enqueued run=${runId} frame=${frame}`);
  }

  /**
   * Operator-uploaded thumbnail override. Inserts a `variant='override'`
   * row that sits alongside the auto-generated thumbnail; the auto-render
   * handler's idempotent delete preserves overrides (it filters
   * `.is('variant', null)`).
   */
  async replaceThumbnail(
    runId: string,
    file: UploadedThumbnail,
  ): Promise<{ storage_url: string; asset_id: string }> {
    if (file.mimetype !== 'image/png' && file.mimetype !== 'image/jpeg') {
      throw new BadRequestException(
        `unsupported file type ${file.mimetype} — must be image/png or image/jpeg`,
      );
    }
    const client = this.supabase.getClient();
    const { data: run, error: runErr } = await client
      .from('content_runs')
      .select('id')
      .eq('id', runId)
      .maybeSingle();
    if (runErr) throw runErr;
    if (!run) throw new NotFoundException(`run ${runId} not found`);

    // Always store under .png path for predictability — Supabase serves
    // whatever bytes we upload regardless of extension; the contentType
    // header on the GET response is what matters for browsers.
    const storagePath = `runs/${runId}/thumbnail-override.png`;
    const { error: uploadErr } = await client.storage
      .from('content-pipeline')
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });
    if (uploadErr) throw uploadErr;

    const storageUrl = `supabase://content-pipeline/${storagePath}`;
    const { data: asset, error: insertErr } = await client
      .from('content_assets')
      .insert({
        run_id: runId,
        kind: 'thumbnail',
        variant: 'override',
        storage_url: storageUrl,
        metadata: {
          source: 'operator_upload',
          originalName: file.originalname,
          mime: file.mimetype,
          size: file.size,
        },
      })
      .select()
      .single();
    if (insertErr) throw insertErr;

    this.logger.log(
      `[THUMB] replace run=${runId} size=${file.size} mime=${file.mimetype}`,
    );
    return { storage_url: storageUrl, asset_id: asset.id as string };
  }
}
