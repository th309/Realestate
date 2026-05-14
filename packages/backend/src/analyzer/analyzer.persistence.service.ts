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
   * Insert a new saved analysis for the owner with a generated share token.
   *
   * Returns the new row's `id` and `share_token`; the share token is the
   * only piece a caller needs to build a `/share/:token` link.
   */
  async save(ownerId: string, dto: AnalysisSnapshotDto) {
    // 24 bytes → 32 base64url chars → 192 bits of entropy.
    const shareToken = crypto.randomBytes(24).toString('base64url');
    const { data, error } = await this.supabase
      .from('deal_analyses')
      .insert({ owner_id: ownerId, share_token: shareToken, ...dto })
      .select('id, share_token')
      .single();
    if (error) throw new Error(`save failed: ${error.message}`);
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
}
