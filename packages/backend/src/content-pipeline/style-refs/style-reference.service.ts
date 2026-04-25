import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { VisionExtractorService } from './vision-extractor.service';
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
 *      + typography + layout + summary
 *   4. row updated with attrs + cost; consumer (Task 2.28 thumbnail
 *      variants) reads palette to drive styleVariant rendering
 *
 * Re-extract is exposed separately for cases where the operator changed
 * the source image or wants to re-run after a model upgrade.
 */
@Injectable()
export class StyleReferenceService {
  private readonly logger = new Logger(StyleReferenceService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly vision: VisionExtractorService,
  ) {}

  async list(userId: string | null): Promise<StyleReference[]> {
    const client = this.supabase.getClient();
    const q = client
      .from('style_references')
      .select('*')
      .order('created_at', { ascending: false });
    const { data, error } = userId ? await q.eq('user_id', userId) : await q;
    if (error) throw error;
    return (data ?? []) as StyleReference[];
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

    // Fire-and-forget extraction; the row exists either way and the
    // operator can re-extract if this fails. Awaited here so the response
    // includes the attrs when it works.
    try {
      const attrs = await this.vision.extract(dto.source_url);
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
        })
        .eq('id', data.id)
        .select('*')
        .single();
      this.logger.log(
        `[STYLE] extracted id=${data.id} palette=${attrs.palette.length}`,
      );
      return (updated ?? data) as StyleReference;
    } catch (err) {
      this.logger.warn(
        `[STYLE] extraction failed for id=${data.id} — operator can re-extract: ${(err as Error).message.slice(0, 120)}`,
      );
      return data as StyleReference;
    }
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

  /** Re-run Vision extraction on an existing reference's source_url. */
  async reExtract(id: string): Promise<StyleReference> {
    const client = this.supabase.getClient();
    const { data: row } = await client
      .from('style_references')
      .select('source_url')
      .eq('id', id)
      .maybeSingle();
    if (!row?.source_url)
      throw new NotFoundException(`style ref ${id} has no source_url`);
    const attrs = await this.vision.extract(row.source_url as string);
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
      })
      .eq('id', id)
      .select('*')
      .single();
    if (error || !updated)
      throw new BadRequestException(error?.message ?? 'failed to update');
    return updated as StyleReference;
  }
}
