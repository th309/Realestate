import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { UpdateMagnetDto } from '../dto/update-magnet.dto';
import type { BindMagnetDto, UpdateBindingDto } from '../dto/bind-magnet.dto';

export interface MagnetDefinition {
  kind: string;
  display_name: string;
  description: string | null;
  audience: string;
  template_path: string;
  data_method: string;
  data_default_args: Record<string, unknown>;
  email_template_key: string;
  landing_page_path: string;
  cover_image_url: string | null;
  enabled: boolean;
  version: number;
  updated_at: string;
}

export interface FormatBinding {
  id: string;
  format: string;
  magnet_kind: string;
  cta_text: string;
  weight: number;
  enabled: boolean;
  updated_at: string;
}

/**
 * CRUD over `lead_magnet_definitions` and `format_magnet_bindings`. The
 * publishers consume these (publish-*.handler's `createShortLink` reads
 * the binding to pick which lead_magnet to attribute the short link to).
 *
 * Magnet content (templates, data fetchers, email templates) is created
 * via seed migrations; this admin surface only edits operator-tunable
 * fields (display name, description, audience, cover, enabled) and
 * manages bindings.
 */
@Injectable()
export class MagnetLibraryService {
  private readonly logger = new Logger(MagnetLibraryService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async listMagnets(): Promise<MagnetDefinition[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('lead_magnet_definitions')
      .select('*')
      .order('display_name');
    if (error) throw error;
    return (data ?? []) as MagnetDefinition[];
  }

  async listBindings(): Promise<FormatBinding[]> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('format_magnet_bindings')
      .select('*')
      .order('format');
    if (error) throw error;
    return (data ?? []) as FormatBinding[];
  }

  async updateMagnet(
    kind: string,
    dto: UpdateMagnetDto,
  ): Promise<MagnetDefinition> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('lead_magnet_definitions')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('kind', kind)
      .select('*')
      .single();
    if (error || !data) {
      throw new NotFoundException(
        error?.message ?? `magnet '${kind}' not found`,
      );
    }
    this.logger.log(
      `[MAGNET] update ${kind} keys=${Object.keys(dto).join(',')}`,
    );
    return data as MagnetDefinition;
  }

  async createBinding(dto: BindMagnetDto): Promise<FormatBinding> {
    const client = this.supabase.getClient();
    const { data: magnet } = await client
      .from('lead_magnet_definitions')
      .select('kind')
      .eq('kind', dto.magnet_kind)
      .maybeSingle();
    if (!magnet) {
      throw new BadRequestException(
        `magnet kind '${dto.magnet_kind}' does not exist`,
      );
    }
    const { data, error } = await client
      .from('format_magnet_bindings')
      .insert({
        format: dto.format,
        magnet_kind: dto.magnet_kind,
        cta_text: dto.cta_text,
        weight: dto.weight ?? 1.0,
        enabled: dto.enabled ?? true,
      })
      .select('*')
      .single();
    if (error || !data) {
      throw new BadRequestException(
        error?.message ?? 'failed to create binding',
      );
    }
    this.logger.log(
      `[MAGNET] bind ${dto.format}→${dto.magnet_kind} weight=${dto.weight ?? 1.0}`,
    );
    return data as FormatBinding;
  }

  async updateBinding(
    id: string,
    dto: UpdateBindingDto,
  ): Promise<FormatBinding> {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('format_magnet_bindings')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error || !data) {
      throw new NotFoundException(
        error?.message ?? `binding '${id}' not found`,
      );
    }
    return data as FormatBinding;
  }

  async deleteBinding(id: string): Promise<void> {
    const client = this.supabase.getClient();
    const { error } = await client
      .from('format_magnet_bindings')
      .delete()
      .eq('id', id);
    if (error) throw error;
    this.logger.log(`[MAGNET] unbind ${id}`);
  }
}
