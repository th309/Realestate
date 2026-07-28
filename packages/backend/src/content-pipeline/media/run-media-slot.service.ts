import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { signStoragePath } from '../asset-signing';
import { readImageDimensions } from './image-dimensions';
import {
  resolveMediaType,
  type MediaSlotKind,
  type MediaType,
} from './slot-media-types';

import { probeVideoDimensions } from './video-dimensions';

// Re-exported so existing importers (controller size caps, tests) keep
// working after the allowlist moved into its own module.
export {
  SLOT_IMAGE_MAX_BYTES,
  SLOT_VIDEO_MAX_BYTES,
  type MediaSlotKind,
} from './slot-media-types';

export interface UploadedSlotAsset {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
}

export interface MediaSlotUploadResult {
  url: string;
  slotId: string;
  kind: MediaSlotKind;
  sourceAspect: number | null;
  bytes: number;
}

const BUCKET = 'content-pipeline';
/** content_assets.kind for slot assets; the slotId goes in `variant`. */
const ASSET_KIND = 'media_slot';

/**
 * Operator-supplied media for a named slot on one run.
 *
 * Every format before media slots was generated end to end from market data,
 * so there was nowhere to hand a template a screenshot or a clip. This is
 * that door: one asset per slot per run, stored under the run's prefix and
 * recorded as a `content_assets` row a later render reads back.
 *
 * Mirrors RunThumbnailService (multipart in, Supabase Storage out, asset row
 * persisted) and keeps its strictness — the MIME allowlist is enforced here,
 * server-side, not left to a client `accept` hint.
 */
@Injectable()
export class RunMediaSlotService {
  private readonly logger = new Logger(RunMediaSlotService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async uploadSlotAsset(
    runId: string,
    slotId: string,
    file: UploadedSlotAsset,
  ): Promise<MediaSlotUploadResult> {
    const mediaType = resolveMediaType(file, this.logger);
    const bytes = file.buffer.length;
    if (bytes === 0) {
      throw new BadRequestException('uploaded file is empty');
    }
    // Multer's own limit is the larger of the two caps, so the image ceiling
    // only exists if it is enforced here.
    if (bytes > mediaType.maxBytes) {
      throw new BadRequestException(
        `file is ${formatMb(bytes)} — ${mediaType.kind} slots are capped at ${formatMb(mediaType.maxBytes)}`,
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

    const sourceAspect = await this.probeSourceAspect(file, mediaType, slotId);

    const storagePath = `runs/${runId}/slots/${slotId}.${mediaType.extension}`;
    const previousPaths = await this.findPreviousPaths(runId, slotId);

    const { error: uploadErr } = await client.storage
      .from(BUCKET)
      .upload(storagePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });
    if (uploadErr) throw uploadErr;

    // A re-upload in a different format lands on a different path, so the
    // previous bytes would otherwise linger and shadow nothing. Log a failed
    // cleanup rather than swallowing it — an orphaned blob is cheap, but an
    // invisible one nobody can account for is not.
    const stale = previousPaths.filter((p) => p !== storagePath);
    if (stale.length > 0) {
      const { error: removeErr } = await client.storage
        .from(BUCKET)
        .remove(stale);
      if (removeErr) {
        this.logger.warn(
          `[SLOT] could not remove replaced asset(s) ${stale.join(', ')}: ${removeErr.message}`,
        );
      }
    }

    await this.replaceAssetRow(runId, slotId, storagePath, {
      source: 'operator_upload',
      slotId,
      mediaKind: mediaType.kind,
      mime: file.mimetype,
      originalName: file.originalname,
      bytes,
      sourceAspect,
    });

    this.logger.log(
      `[SLOT] upload run=${runId} slot=${slotId} kind=${mediaType.kind} ` +
        `bytes=${bytes} aspect=${sourceAspect ?? 'unknown'}`,
    );

    return {
      url: await signStoragePath(client, BUCKET, storagePath),
      slotId,
      kind: mediaType.kind,
      sourceAspect,
      bytes,
    };
  }

  /**
   * width/height of the asset, which the renderer needs to map an
   * operator-authored focus region onto a differently-shaped frame.
   *
   * Deliberately swallows every failure: a probe is a convenience, and an
   * unreadable header or a missing ffprobe must not cost the operator an
   * upload they can otherwise use full-frame.
   */
  private async probeSourceAspect(
    file: UploadedSlotAsset,
    mediaType: MediaType,
    slotId: string,
  ): Promise<number | null> {
    try {
      const dimensions =
        mediaType.kind === 'image'
          ? readImageDimensions(file.buffer)
          : await probeVideoDimensions(file.buffer, mediaType.extension);
      if (!dimensions) {
        this.logger.warn(
          `[SLOT] could not read dimensions for slot=${slotId} mime=${file.mimetype}`,
        );
        return null;
      }
      return dimensions.width / dimensions.height;
    } catch (err) {
      this.logger.warn(
        `[SLOT] dimension probe failed for slot=${slotId}: ${(err as Error)?.message ?? String(err)}`,
      );
      return null;
    }
  }

  /**
   * Storage paths of the assets this upload replaces.
   *
   * Returns a LIST, and deliberately does not use `.maybeSingle()`. Nothing
   * at the database level enforces one row per slot — the row swap below is
   * a delete-then-insert, not an atomic upsert — so two uploads racing the
   * same slot (a double-click on a slow multi-MB upload is enough) can
   * momentarily leave two rows. `.maybeSingle()` THROWS on more than one
   * match, which would wedge that slot permanently: every subsequent upload
   * would fail here, with no way for an operator to recover short of
   * hand-deleting a row. Tolerating the duplicate instead makes the next
   * upload clean it up.
   */
  private async findPreviousPaths(
    runId: string,
    slotId: string,
  ): Promise<string[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('content_assets')
      .select('storage_url')
      .eq('run_id', runId)
      .eq('kind', ASSET_KIND)
      .eq('variant', slotId);
    if (error) throw error;
    return (data ?? [])
      .map((row) =>
        String(row.storage_url ?? '').match(/^supabase:\/\/[^/]+\/(.+)$/),
      )
      .filter((m): m is RegExpMatchArray => Boolean(m))
      .map((m) => m[1]);
  }

  /**
   * Collapse the slot to exactly one row: delete every existing row for it,
   * then insert the new one.
   *
   * Not atomic — there is no transaction and no unique constraint behind it
   * (`content_assets`' only unique index is a partial one on content_hash,
   * which this path never sets). Two racing uploads can therefore both
   * delete before either inserts, briefly leaving two rows. That is tolerated
   * rather than prevented: the read side handles duplicates and the next
   * upload collapses them. A partial unique index on (run_id, kind, variant)
   * plus an ON CONFLICT upsert would remove the window entirely and is the
   * right follow-up when this becomes operator-facing.
   */
  private async replaceAssetRow(
    runId: string,
    slotId: string,
    storagePath: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    const client = this.supabase.getClient();
    const { error: deleteErr } = await client
      .from('content_assets')
      .delete()
      .eq('run_id', runId)
      .eq('kind', ASSET_KIND)
      .eq('variant', slotId);
    if (deleteErr) throw deleteErr;

    const { error: insertErr } = await client.from('content_assets').insert({
      run_id: runId,
      kind: ASSET_KIND,
      variant: slotId,
      storage_url: `supabase://${BUCKET}/${storagePath}`,
      metadata,
    });
    if (insertErr) throw insertErr;
  }
}

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
