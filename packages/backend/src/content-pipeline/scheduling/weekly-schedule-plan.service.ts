// packages/backend/src/content-pipeline/scheduling/weekly-schedule-plan.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import type { UpdateWeeklySchedulePlanDto } from './dto/update-weekly-schedule-plan.dto';
import {
  DEFAULT_WEEKLY_SCHEDULE_PLAN,
  type PlanSlot,
  type PostTypeSlotRule,
  type WeeklySchedulePlan,
} from './weekly-schedule-plan.types';

const TABLE = 'content_schedule_plans';

/** Raw content_schedule_plans row. */
interface SchedulePlanRow {
  brand_id: string;
  enabled: boolean;
  rules: PostTypeSlotRule[];
  fallback_slots: PlanSlot[];
  max_per_day: number;
  min_gap_minutes: number;
  min_lead_minutes: number;
  horizon_weeks: number;
}

function rowToPlan(row: SchedulePlanRow): WeeklySchedulePlan {
  return {
    enabled: row.enabled,
    rules: row.rules ?? [],
    fallbackSlots: row.fallback_slots ?? [],
    maxPerDay: row.max_per_day,
    minGapMinutes: row.min_gap_minutes,
    minLeadMinutes: row.min_lead_minutes,
    horizonWeeks: row.horizon_weeks,
  };
}

/**
 * Reads and writes a brand's weekly auto-scheduling plan.
 *
 * Read-through default: a brand with no row yet gets
 * DEFAULT_WEEKLY_SCHEDULE_PLAN, so auto-scheduling works the moment the feature
 * ships without a data migration seeding every brand. The seed lives in
 * TypeScript only — the migration deliberately does not duplicate the slot
 * arrays into SQL, so the two cannot drift.
 *
 * Deliberately NOT cached. The `enabled` field is the operator's kill switch;
 * a cache would leave auto-scheduling running for the length of its TTL after
 * someone switched it off.
 */
@Injectable()
export class WeeklySchedulePlanService {
  private readonly logger = new Logger(WeeklySchedulePlanService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /** A brand's plan, or the seeded default when it has never been edited. */
  async getPlan(brandId: string): Promise<WeeklySchedulePlan> {
    const { data, error } = await this.supabase
      .getClient()
      .from(TABLE)
      .select('*')
      .eq('brand_id', brandId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return { ...DEFAULT_WEEKLY_SCHEDULE_PLAN };
    return rowToPlan(data as SchedulePlanRow);
  }

  /**
   * Apply a partial edit to a brand's plan and return the result. Fields the
   * caller omitted keep their current value (or the default, for a brand whose
   * row does not exist yet), so `{ enabled: false }` is a complete request.
   */
  async updatePlan(
    brandId: string,
    patch: UpdateWeeklySchedulePlanDto,
  ): Promise<WeeklySchedulePlan> {
    const current = await this.getPlan(brandId);
    const merged: WeeklySchedulePlan = {
      enabled: patch.enabled ?? current.enabled,
      rules: patch.rules ?? current.rules,
      fallbackSlots: patch.fallbackSlots ?? current.fallbackSlots,
      maxPerDay: patch.maxPerDay ?? current.maxPerDay,
      minGapMinutes: patch.minGapMinutes ?? current.minGapMinutes,
      minLeadMinutes: patch.minLeadMinutes ?? current.minLeadMinutes,
      horizonWeeks: patch.horizonWeeks ?? current.horizonWeeks,
    };

    const { data, error } = await this.supabase
      .getClient()
      .from(TABLE)
      .upsert(
        {
          brand_id: brandId,
          enabled: merged.enabled,
          rules: merged.rules,
          fallback_slots: merged.fallbackSlots,
          max_per_day: merged.maxPerDay,
          min_gap_minutes: merged.minGapMinutes,
          min_lead_minutes: merged.minLeadMinutes,
          horizon_weeks: merged.horizonWeeks,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'brand_id' },
      )
      .select('*')
      .single();
    if (error) throw error;

    this.logger.log(
      `schedule plan updated for brand ${brandId} (auto-scheduling ${merged.enabled ? 'on' : 'off'})`,
    );
    return rowToPlan(data as SchedulePlanRow);
  }
}
