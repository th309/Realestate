import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin-auth.guard';
import { SupabaseService } from '../../supabase/supabase.service';
import { ScriptArchetypeService } from './script-archetype.service';

@UseGuards(AdminGuard)
@Controller('api/admin/content-pipeline/archetypes')
export class ArchetypeLibraryController {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly archetypes: ScriptArchetypeService,
  ) {}

  @Get()
  async list(@Query('format') format?: string) {
    const client = this.supabase.getClient();
    const q = client
      .from('script_archetypes')
      .select('*')
      .order('median_view_count', { ascending: false, nullsFirst: false });
    const { data } =
      format && format.length > 0
        ? await q.contains('format_affinity', [format])
        : await q;
    return { success: true, data: { archetypes: data ?? [] } };
  }

  @Patch(':slug')
  async update(
    @Param('slug') slug: string,
    @Body()
    body: { display_name?: string; description?: string; enabled?: boolean },
  ) {
    const client = this.supabase.getClient();
    const { data, error } = await client
      .from('script_archetypes')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('slug', slug)
      .select('*')
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }

  @Post('refresh')
  async refresh() {
    // Fire-and-forget so the operator gets a quick ack; real progress is
    // visible via /refresh-runs (and the cron logs).
    this.archetypes.refresh().catch(() => {
      /* logged inside service */
    });
    return { success: true, data: { queued: true } };
  }

  @Get('refresh-runs')
  async refreshRuns() {
    const client = this.supabase.getClient();
    const { data } = await client
      .from('archetype_refresh_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(20);
    return { success: true, data: { runs: data ?? [] } };
  }
}
