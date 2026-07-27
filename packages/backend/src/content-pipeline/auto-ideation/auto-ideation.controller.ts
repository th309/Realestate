import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin-auth.guard';
import { SupabaseService } from '../../supabase/supabase.service';
import { CreateTriggerRuleDto } from '../dto/create-trigger-rule.dto';
import { UpdateTriggerRuleDto } from '../dto/update-trigger-rule.dto';
import { isValidTriggerConfig } from '../dto/trigger-config.dto';
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
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTriggerRuleDto,
  ) {
    const client = this.supabase.getClient();
    const patch: Record<string, unknown> = {
      ...dto,
      updated_at: new Date().toISOString(),
    };
    // The PATCH DTO has no trigger_type, so it can't self-discriminate: validate
    // the MERGED config against the rule's EXISTING trigger_type so a partial
    // update can't strip a required field (e.g. lookback_days → NaN crash).
    if (dto.trigger_config !== undefined) {
      const { data: existing, error: exErr } = await client
        .from('auto_ideation_rules')
        .select('trigger_type, trigger_config')
        .eq('id', id)
        .single();
      if (exErr || !existing) throw new NotFoundException('rule not found');
      const merged = {
        ...((existing.trigger_config as Record<string, unknown>) ?? {}),
        ...(dto.trigger_config as Record<string, unknown>),
      };
      if (!isValidTriggerConfig(existing.trigger_type as string, merged)) {
        throw new BadRequestException(
          'trigger_config does not match the rule trigger_type',
        );
      }
      patch.trigger_config = merged;
    }
    const { data, error } = await client
      .from('auto_ideation_rules')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return { success: true, data };
  }

  @Delete('rules/:id')
  async remove(@Param('id', new ParseUUIDPipe()) id: string) {
    const { error } = await this.supabase
      .getClient()
      .from('auto_ideation_rules')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return { success: true, data: { deleted: true } };
  }

  @Post('rules/:id/fire-now')
  async fireNow(@Param('id', new ParseUUIDPipe()) id: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('auto_ideation_rules')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) throw new NotFoundException('rule not found');
    // Return honest counts so the UI never claims success on 0 matches. Shape
    // evaluator/config failures (e.g. a malformed rule) as a 400, not a raw 500.
    try {
      const result = await this.service.evaluateAndEnqueue(data);
      return { success: true, data: result };
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new BadRequestException(
        `rule evaluation failed: ${(err as Error).message}`,
      );
    }
  }

  @Get('upcoming')
  async upcoming() {
    return {
      success: true,
      data: { upcoming: await this.service.previewUpcoming() },
    };
  }
}
