import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { VisionExtractorService } from './vision-extractor.service';
import { StyleReferencePreviewService } from './style-reference-preview.service';
import type {
  CreateStyleReferenceDto,
  UpdateStyleReferenceDto,
} from '../dto/style-reference.dto';

export interface StyleReference {
  id: string;
  user_id: string;
  kind: string;
  label: string;
  source_url: string | null;
  preview_strip_url: string | null;
  extracted_attributes: {
    palette?: string[];
    typography?: string[];
    layout?: string[];
    summary?: string;
  };
  vision_cost_usd: number;
  created_at: string;
}

/**
 * CRUD over `style_references`. Create flow:
 *   1. operator uploads image OR pastes URL
 *   2. service stores row with empty extracted_attributes
 *   3. service calls VisionExtractorService.extract() to populate palette
 *      + typography + layout + summary, and mirrors the image into the
 *      `content-pipeline` bucket so the card preview outlives the source URL
 *   4. row updated with attrs + cost; consumer (Task 2.28 thumbnail
 *      variants) reads palette to drive styleVariant rendering
 *
 * `list()` resolves stored `supabase://` previews to short-lived signed URLs
 * for the browser. Re-extract is exposed separately for cases where the
 * operator changed the source image or wants to re-run after a model upgrade;
 * it also backfills missing preview mirrors.
 */
@Injectable()
export class StyleReferenceService {
  private readonly logger = new Logger(StyleReferenceService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly vision: VisionExtractorService,
    private readonly preview: StyleReferencePreviewService,
  ) {}

  async list(userId: string | null): Promise<StyleReference[]> {
    const client = this.supabase.getClient();
    const q = client
      .from('style_references')
      .select('*')
      .order('created_at', { ascending: false });
    const { data, error } = userId ? await q.eq('user_id', userId) : await q;
    if (error) throw error;
    const refs = (data ?? []) as StyleReference[];
    return Promise.all(
      refs.map(async (ref) => ({
        ...ref,
        preview_strip_url: await this.preview.toSignedPreviewUrl(
          ref.preview_strip_url,
        ),
      })),
    );
  }

  async create(
    userId: string,
    dto: CreateStyleReferenceDto,
  ): Promise<StyleReference> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('style_references')
      .insert({
        user_id: userId,
        kind: dto.kind,
        label: dto.label,
        source_url: dto.source_url,
        preview_strip_url: dto.preview_strip_url ?? null,
        extracted_attributes: {},
        vision_cost_usd: 0,
      })
      .select('*')
      .single();
    if (error || !data)
      throw new BadRequestException(error?.message ?? 'failed to create');

    // Extraction + preview mirror are independent best-effort steps; the row
    // exists either way and the operator can re-extract. Awaited here so the
    // response includes the attrs when they work. A completed mirror is
    // persisted even when vision fails — discarding it would orphan the
    // uploaded storage object.
    const [attrsResult, mirroredPreview] = await Promise.all([
      this.vision.extract(dto.source_url).then(
        (attrs) => ({ ok: true as const, attrs }),
        (err: Error) => ({ ok: false as const, err }),
      ),
      dto.preview_strip_url
        ? Promise.resolve<string | null>(dto.preview_strip_url)
        : this.preview.mirrorImageToStorage(userId, dto.source_url),
    ]);

    if (!attrsResult.ok) {
      this.logger.warn(
        `[STYLE] extraction failed for id=${data.id} — operator can re-extract: ${attrsResult.err.message.slice(0, 120)}`,
      );
      if (!mirroredPreview) return data as StyleReference;
      const { data: previewOnly } = await client
        .from('style_references')
        .update({ preview_strip_url: mirroredPreview })
        .eq('id', data.id)
        .select('*')
        .single();
      return (previewOnly ?? data) as StyleReference;
    }

    const { attrs } = attrsResult;
    const { data: updated } = await client
      .from('style_references')
      .update({
        extracted_attributes: {
          palette: attrs.palette,
          typography: attrs.typography,
          layout: attrs.layout,
          summary: attrs.summary,
        },
        vision_cost_usd: attrs.cost_usd,
        preview_strip_url: mirroredPreview,
      })
      .eq('id', data.id)
      .select('*')
      .single();
    this.logger.log(
      `[STYLE] extracted id=${data.id} palette=${attrs.palette.length} preview=${mirroredPreview ? 'mirrored' : 'none'}`,
    );
    return (updated ?? data) as StyleReference;
  }

  async update(
    id: string,
    dto: UpdateStyleReferenceDto,
  ): Promise<StyleReference> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('style_references')
      .update(dto)
      .eq('id', id)
      .select('*')
      .single();
    if (error || !data)
      throw new NotFoundException(
        error?.message ?? `style ref ${id} not found`,
      );
    return data as StyleReference;
  }

  async delete(id: string): Promise<void> {
    const client = this.supabase.getClient();
    const { error } = await client
      .from('style_references')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  /**
   * Re-run Vision extraction on an existing reference's source_url, and
   * backfill the storage preview mirror when the row predates mirroring.
   */
  async reExtract(id: string): Promise<StyleReference> {
    const client = this.supabase.getClient();
    const { data: row } = await client
      .from('style_references')
      .select('user_id, source_url, preview_strip_url')
      .eq('id', id)
      .maybeSingle();
    if (!row?.source_url)
      throw new NotFoundException(`style ref ${id} has no source_url`);

    const hasMirror = String(row.preview_strip_url ?? '').startsWith(
      'supabase://',
    );
    const [attrsResult, mirroredPreview] = await Promise.all([
      this.vision.extract(row.source_url as string).then(
        (attrs) => ({ ok: true as const, attrs }),
        (err: Error) => ({ ok: false as const, err }),
      ),
      hasMirror
        ? Promise.resolve<string | null>(row.preview_strip_url as string)
        : this.preview.mirrorImageToStorage(
            row.user_id as string,
            row.source_url as string,
          ),
    ]);

    // Persist a fresh mirror even when vision fails, then surface the vision
    // failure as a client error instead of an opaque 500.
    if (!attrsResult.ok) {
      if (mirroredPreview && !hasMirror) {
        await client
          .from('style_references')
          .update({ preview_strip_url: mirroredPreview })
          .eq('id', id);
      }
      throw new BadRequestException(
        `Vision extraction failed: ${attrsResult.err.message.slice(0, 200)}`,
      );
    }

    const { attrs } = attrsResult;
    const { data: updated, error } = await client
      .from('style_references')
      .update({
        extracted_attributes: {
          palette: attrs.palette,
          typography: attrs.typography,
          layout: attrs.layout,
          summary: attrs.summary,
        },
        vision_cost_usd: attrs.cost_usd,
        preview_strip_url: mirroredPreview,
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error || !updated)
      throw new BadRequestException(error?.message ?? 'failed to update');
    return updated as StyleReference;
  }
}
