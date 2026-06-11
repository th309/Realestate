/**
 * AI Shadow Controller
 *
 * Admin-guarded endpoints for the /admin/ai-models/shadow page:
 *  - GET    /api/admin/ai-shadow/pairs   — list shadow_log rows
 *  - PATCH  /api/admin/ai-shadow/pairs/:id — rate a pair (preferred + note)
 *  - GET    /api/admin/ai-shadow/config  — global runtime config
 *  - PATCH  /api/admin/ai-shadow/config  — toggle enabled / set ceiling
 *  - GET    /api/admin/ai-shadow/tally   — per-purpose preference counts
 */

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AdminGuard } from '../common/guards/admin-auth.guard';
import { SupabaseService } from '../supabase/supabase.service';

@Controller('api/admin/ai-shadow')
@UseGuards(AdminGuard)
export class AiShadowController {
  constructor(private readonly supabase: SupabaseService) {}

  @Get('pairs')
  async listPairs(
    @Query('purpose') purpose?: string,
    @Query('unreviewed_only') unreviewedOnly?: string,
    @Query('limit') limit?: string,
  ) {
    const client = this.supabase.getClient();
    let q = client
      .from('ai_shadow_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit ? Math.min(Number(limit), 200) : 50);
    if (purpose) q = q.eq('purpose', purpose);
    if (unreviewedOnly === 'true') q = q.is('preferred', null);
    const { data, error } = await q;
    if (error) throw error;
    return { pairs: data ?? [] };
  }

  @Patch('pairs/:id')
  async ratePair(
    @Param('id') id: string,
    @Body()
    body: { preferred: 'primary' | 'shadow' | 'tie'; reviewer_note?: string },
    @Req() req: { userId?: string },
  ) {
    const { error } = await this.supabase
      .getClient()
      .from('ai_shadow_log')
      .update({
        preferred: body.preferred,
        reviewer_note: body.reviewer_note ?? null,
        reviewed_by: req.userId ?? null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw error;
    return { ok: true };
  }

  @Get('config')
  async getConfig() {
    const { data, error } = await this.supabase
      .getClient()
      .from('ai_shadow_config')
      .select('enabled, daily_usd_ceiling, updated_at')
      .eq('id', 1)
      .maybeSingle();
    if (error) throw error;
    return data ?? { enabled: false, daily_usd_ceiling: 5 };
  }

  @Patch('config')
  async updateConfig(
    @Body() body: { enabled?: boolean; daily_usd_ceiling?: number },
  ) {
    const update: Record<string, unknown> = {};
    if (typeof body.enabled === 'boolean') update.enabled = body.enabled;
    if (typeof body.daily_usd_ceiling === 'number')
      update.daily_usd_ceiling = body.daily_usd_ceiling;
    const { error } = await this.supabase
      .getClient()
      .from('ai_shadow_config')
      .update(update)
      .eq('id', 1);
    if (error) throw error;
    return { ok: true };
  }

  @Get('tally')
  async getTally(@Query('purpose') purpose?: string) {
    const client = this.supabase.getClient();
    let q = client
      .from('ai_shadow_log')
      .select('purpose, preferred, primary_cost_usd, shadow_cost_usd');
    if (purpose) q = q.eq('purpose', purpose);
    const { data, error } = await q;
    if (error) throw error;

    type Tally = {
      purpose: string;
      primary: number;
      shadow: number;
      tie: number;
      unreviewed: number;
      avgPrimaryCost: number;
      avgShadowCost: number;
    };
    const byPurpose = new Map<string, Tally>();
    for (const row of data ?? []) {
      const t = byPurpose.get(row.purpose) ?? {
        purpose: row.purpose,
        primary: 0,
        shadow: 0,
        tie: 0,
        unreviewed: 0,
        avgPrimaryCost: 0,
        avgShadowCost: 0,
      };
      if (row.preferred === 'primary') t.primary++;
      else if (row.preferred === 'shadow') t.shadow++;
      else if (row.preferred === 'tie') t.tie++;
      else t.unreviewed++;
      t.avgPrimaryCost += Number(row.primary_cost_usd ?? 0);
      t.avgShadowCost += Number(row.shadow_cost_usd ?? 0);
      byPurpose.set(row.purpose, t);
    }
    for (const t of byPurpose.values()) {
      const n = t.primary + t.shadow + t.tie + t.unreviewed;
      if (n > 0) {
        t.avgPrimaryCost /= n;
        t.avgShadowCost /= n;
      }
    }
    return { tallies: Array.from(byPurpose.values()) };
  }
}
