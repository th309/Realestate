import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin-auth.guard';
import { SupabaseService } from '../../supabase/supabase.service';
import { CreateTriggerRuleDto } from '../dto/create-trigger-rule.dto';
import { UpdateTriggerRuleDto } from '../dto/update-trigger-rule.dto';
import { AutoIdeationService } from './auto-ideation.service';

@UseGuards(AdminGuard)
@Controller('api/admin/content-pipeline/auto-ideation')
export class AutoIdeationController {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly service: AutoIdeationService,
  ) {}

  @Get('rules')
  async list() {
    const { data, error } = await this.supabase
      .getClient()
      .from('auto_ideation_rules')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return { success: true, data: { rules: data ?? [] } };
  }

  @Post('rules')
  async create(@Body() dto: CreateTriggerRuleDto) {
    const { data, error } = await this.supabase
      .getClient()
      .from('auto_ideation_rules')
      .insert({ ...dto, enabled: dto.enabled ?? false })
      .select()
      .single();
    if (error) throw error;
    return { success: true, data };
  }

  @Patch('rules/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateTriggerRuleDto) {
    const { data, error } = await this.supabase
      .getClient()
      .from('auto_ideation_rules')
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return { success: true, data };
  }

  @Delete('rules/:id')
  async remove(@Param('id') id: string) {
    const { error } = await this.supabase
      .getClient()
      .from('auto_ideation_rules')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return { success: true, data: { deleted: true } };
  }

  @Post('rules/:id/fire-now')
  async fireNow(@Param('id') id: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('auto_ideation_rules')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) throw error ?? new Error('rule not found');
    await this.service.evaluateAndEnqueue(data as any);
    return { success: true, data: { fired: true } };
  }

  @Get('upcoming')
  async upcoming() {
    return {
      success: true,
      data: { upcoming: await this.service.previewUpcoming() },
    };
  }
}

