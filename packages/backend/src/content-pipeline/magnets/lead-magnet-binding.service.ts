import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class LeadMagnetBindingService {
  constructor(private readonly supabase: SupabaseService) {}

  async pickBinding(
    format: string,
  ): Promise<{ id: string; magnet_kind: string; cta_text: string } | null> {
    const client = this.supabase.getClient();
    const { data: bindings } = await client
      .from('format_magnet_bindings')
      .select('id, magnet_kind, cta_text, weight')
      .eq('format', format)
      .eq('enabled', true);
    if (!bindings || bindings.length === 0) return null;

    const total = (bindings as any[]).reduce(
      (s, b) => s + Number(b.weight ?? 0),
      0,
    );
    if (!Number.isFinite(total) || total <= 0) return bindings[0] as any;

    let r = Math.random() * total;
    for (const b of bindings as any[]) {
      r -= Number(b.weight ?? 0);
      if (r <= 0) return { id: b.id, magnet_kind: b.magnet_kind, cta_text: b.cta_text };
    }

    const last = bindings[bindings.length - 1] as any;
    return { id: last.id, magnet_kind: last.magnet_kind, cta_text: last.cta_text };
  }

  async getOrPickSelectedBindingIdForRun(
    runId: string,
    format: string,
  ): Promise<string | null> {
    const client = this.supabase.getClient();
    const { data: run } = await client
      .from('content_runs')
      .select('selected_magnet_binding_id')
      .eq('id', runId)
      .single();

    const existing = (run as any)?.selected_magnet_binding_id as
      | string
      | null
      | undefined;
    if (existing) return existing;

    const picked = await this.pickBinding(format);
    if (!picked) return null;

    await client
      .from('content_runs')
      .update({ selected_magnet_binding_id: picked.id })
      .eq('id', runId)
      .is('selected_magnet_binding_id', null);

    return picked.id;
  }
}

