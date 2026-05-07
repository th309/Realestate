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
  delivered_count?: number;
  converted_to_paid_pct?: number;
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
    const magnets = (data ?? []) as MagnetDefinition[];

    // Conversion panel (P4.24): lightweight all-time delivered + paid-converted rate.
    // Uses existing attribution rows (no new schema).
    const [deliveries, attributions] = await Promise.all([
      client
        .from('lead_magnet_deliveries')
        .select('magnet_kind, user_id')
        .limit(5000),
      client
        .from('signup_attributions')
        .select('user_id, tier_at_signup')
        .limit(5000),
    ]);

    const paidUsers = new Set<string>();
    for (const row of attributions.data ?? []) {
      const tier = String((row as any).tier_at_signup ?? '');
      if (!tier) continue;
      if (tier === 'free' || tier === 'trial') continue;
      paidUsers.add(String((row as any).user_id));
    }

    const deliveredByKind = new Map<string, Set<string>>();
    const paidByKind = new Map<string, Set<string>>();
    for (const row of deliveries.data ?? []) {
      const kind = String((row as any).magnet_kind ?? '');
      const userId = String((row as any).user_id ?? '');
      if (!kind || !userId) continue;
      if (!deliveredByKind.has(kind)) deliveredByKind.set(kind, new Set());
      deliveredByKind.get(kind)!.add(userId);
      if (paidUsers.has(userId)) {
        if (!paidByKind.has(kind)) paidByKind.set(kind, new Set());
        paidByKind.get(kind)!.add(userId);
      }
    }

    return magnets.map((m) => {
      const delivered = deliveredByKind.get(m.kind)?.size ?? 0;
      const paid = paidByKind.get(m.kind)?.size ?? 0;
      return {
        ...m,
        delivered_count: delivered,
        converted_to_paid_pct: delivered > 0 ? paid / delivered : 0,
      };
    });
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
