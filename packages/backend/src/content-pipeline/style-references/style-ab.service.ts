import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

@Injectable()
export class StyleABService {
  constructor(private readonly supabase: SupabaseService) {}

  async pickBinding(
    format: string,
  ): Promise<{ id: string; style_reference_id: string } | null> {
    const client = this.supabase.getClient();
    const { data: bindings } = await client
      .from('format_style_bindings')
      .select('id, style_reference_id, weight')
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
      if (r <= 0) return { id: b.id, style_reference_id: b.style_reference_id };
    }
    const last = bindings[bindings.length - 1] as any;
    return { id: last.id, style_reference_id: last.style_reference_id };
  }

  async getOrPickSelectedStyleReferenceIdForRun(
    runId: string,
    format: string,
  ): Promise<string | null> {
    const client = this.supabase.getClient();
    const { data: run } = await client
      .from('content_runs')
      .select('selected_style_binding_id')
      .eq('id', runId)
      .single();

    const existing = (run as any)?.selected_style_binding_id as
      | string
      | null
      | undefined;
    if (existing) {
      const { data: binding } = await client
        .from('format_style_bindings')
        .select('style_reference_id')
        .eq('id', existing)
        .maybeSingle();
      return (binding as any)?.style_reference_id ?? null;
    }

    const picked = await this.pickBinding(format);
    if (!picked) return null;

    await client
      .from('content_runs')
      .update({ selected_style_binding_id: picked.id })
      .eq('id', runId)
      .is('selected_style_binding_id', null);

    return picked.style_reference_id;
  }
}

