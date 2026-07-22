import { Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import * as crypto from 'node:crypto';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import type { AnalysisSnapshotDto } from './dto/analysis-snapshot.dto';

/**
 * Persistence concerns for the Deal Analyzer.
 *
 * Split out of `AnalyzerService` so the math/AI/market-context surface
 * (`getMarketContext`, `streamAiVerdict`, …) stays focused and the file
 * size stays comfortably under the CLAUDE.md §1.3 logic-file limit.
 *
 * All operations are owner-scoped (the controller resolves `ownerId` from
 * the JWT) except `getShared`, which is intentionally public — possession
 * of the share token is the entitlement and lookup goes through the
 * SECURITY DEFINER RPC `get_shared_analysis`.
 */
@Injectable()
export class AnalyzerPersistenceService {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  /**
   * Upsert a saved analysis for the owner, keyed on `(owner_id, address_full)`
   * — the DB-level unique constraint `deal_analyses_owner_address_unique`
   * enforces at most one row per address per owner.
   *
   * If a row already exists for this owner+address it's updated in place
   * (existing `id` and `share_token` are preserved so any previously
   * distributed share link keeps working); otherwise a new row is inserted
   * with a freshly generated `share_token`. A same-millisecond double-click
   * race that slips past the existence check is caught by falling back to
   * an update when the INSERT hits the unique-violation (Postgres `23505`).
   *
   * Returns `{ id, share_token }` for the (new or existing) row.
   */
  async save(ownerId: string, dto: AnalysisSnapshotDto) {
    const existing = await this.findExisting(ownerId, dto.address_full);
    if (existing) return this.updateExisting(ownerId, existing.id, dto);

    // 24 bytes → 32 base64url chars → 192 bits of entropy.
    const shareToken = crypto.randomBytes(24).toString('base64url');
    const { data, error } = await this.supabase
      .from('deal_analyses')
      .insert({ ...dto, owner_id: ownerId, share_token: shareToken })
      .select('id, share_token')
      .single();
    if (!error) return data;

    // Unique-violation race: another save for the same owner+address won
    // between our existence check and this insert. Fall back to update.
    if (error.code === '23505') {
      const raced = await this.findExisting(ownerId, dto.address_full);
      if (raced) return this.updateExisting(ownerId, raced.id, dto);
    }
    throw new Error(`save failed: ${error.message}`);
  }

  /**
   * Look up an existing row's `id` + `share_token` for this owner+address,
   * or `null` if none exists. Shared by `save()`'s primary path and its
   * unique-violation fallback.
   */
  private async findExisting(ownerId: string, addressFull: string) {
    const { data, error } = await this.supabase
      .from('deal_analyses')
      .select('id, share_token')
      .eq('owner_id', ownerId)
      .eq('address_full', addressFull)
      .maybeSingle();
    if (error) throw new Error(`save lookup failed: ${error.message}`);
    return data;
  }

  /**
   * Update an existing row in place with the new snapshot fields, bumping
   * `updated_at`. Never touches `share_token` — the point of upserting is
   * that previously distributed share links keep resolving to this id.
   *
   * Scoped by both `owner_id` and `id`. `id` alone would still be correct
   * here in practice (it comes from `findExisting()`, which already scoped
   * by owner), but `this.supabase` is the service-role client — see
   * `supabase.module.ts` — so RLS's `deal_analyses_owner_update` policy is
   * not in effect and provides no protection. The `.eq('owner_id', ownerId)`
   * is the actual enforcement, matching `list()`/`getOne()`/`remove()`.
   */
  private async updateExisting(
    ownerId: string,
    id: string,
    dto: AnalysisSnapshotDto,
  ) {
    const { data, error } = await this.supabase
      .from('deal_analyses')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('owner_id', ownerId)
      .eq('id', id)
      .select('id, share_token')
      .single();
    if (error) throw new Error(`save update failed: ${error.message}`);
    return data;
  }

  /**
   * List saved analyses for the owner, newest first. Cursor is the
   * `created_at` of the last row from the previous page.
   */
  async list(
    ownerId: string,
    opts: { limit: number; cursor?: string } = { limit: 20 },
  ) {
    let q = this.supabase
      .from('deal_analyses')
      .select('*')
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(opts.limit);
    if (opts.cursor) q = q.lt('created_at', opts.cursor);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data;
  }

  /**
   * Fetch a single saved analysis owned by the caller. Returns `null` if
   * not found or not owned by them (caller turns this into a 404).
   */
  async getOne(ownerId: string, id: string) {
    const { data, error } = await this.supabase
      .from('deal_analyses')
      .select('*')
      .eq('owner_id', ownerId)
      .eq('id', id)
      .single();
    if (error) return null;
    return data;
  }

  /**
   * Delete a saved analysis owned by the caller. Idempotent — deleting a
   * row that doesn't exist (or isn't owned) is a no-op from PostgREST.
   */
  async remove(ownerId: string, id: string) {
    const { error } = await this.supabase
      .from('deal_analyses')
      .delete()
      .eq('owner_id', ownerId)
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  /**
   * Resolve a public share token via the SECURITY DEFINER RPC from the
   * sharing migration. Returns the first row (the RPC is designed to return
   * at most one) or `null` if the token isn't valid.
   */
  async getShared(token: string) {
    const { data, error } = await this.supabase.rpc('get_shared_analysis', {
      p_token: token,
    });
    if (error) return null;
    if (!data || data.length === 0) return null;
    return data[0];
  }

  /**
   * Resolve the owner's organization branding for a share token via the
   * SECURITY DEFINER RPC `get_shared_analysis_branding`. Returns `null` when
   * the token is invalid, the owner has no org, or the join finds nothing.
   * Frontend callers fall back to PropertyIQ defaults in that case.
   */
  async getSharedBranding(token: string) {
    const { data, error } = await this.supabase.rpc(
      'get_shared_analysis_branding',
      { p_token: token },
    );
    if (error) return null;
    if (!data || data.length === 0) return null;
    return data[0];
  }
}
