import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FEED_POST_TYPES } from '../../feed/feed.types';
import { NON_SCHEDULABLE_POST_TYPES } from '../weekly-schedule-plan.types';

/**
 * Post types a rule may target. Deliberately narrower than FEED_POST_TYPES:
 * video_script can never be scheduled (see NON_SCHEDULABLE_POST_TYPES), so a
 * rule for it is rejected here rather than accepted into a brand's stored plan
 * and only refused later at assignment time. PostAutoSchedulerService has its
 * own defensive check too — this is the write-time half of that guard.
 */
const SCHEDULABLE_POST_TYPES = FEED_POST_TYPES.filter(
  (t) => !NON_SCHEDULABLE_POST_TYPES.has(t),
);

/**
 * One allowed posting window. Every field is bounded here because these numbers
 * feed the slot math directly — an unvalidated hour or weekday would produce a
 * nonsense scheduled_at that the publisher would happily act on.
 */
export class PlanSlotDto {
  /** 0 = Sunday … 6 = Saturday. */
  @IsInt()
  @Min(0)
  @Max(6)
  weekday!: number;

  @IsInt()
  @Min(0)
  @Max(23)
  hour!: number;

  @IsInt()
  @Min(0)
  @Max(59)
  minute!: number;
}

/** The windows one post type may occupy. */
export class PostTypeSlotRuleDto {
  @IsIn(SCHEDULABLE_POST_TYPES as unknown as string[])
  postType!: string;

  @IsArray()
  @ValidateNested({ each: true })
  // 4 windows a day across 7 days is the practical ceiling for one type.
  @ArrayMaxSize(28)
  @Type(() => PlanSlotDto)
  slots!: PlanSlotDto[];
}

/**
 * PUT /schedule-plan/:brandId — replace part or all of a brand's weekly plan.
 * Every field is optional so the kill switch can be flipped on its own:
 * `{ "enabled": false }` is a complete, valid request.
 */
export class UpdateWeeklySchedulePlanDto {
  /** The kill switch. False returns the brand to manual placement. */
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMaxSize(20)
  @Type(() => PostTypeSlotRuleDto)
  rules?: PostTypeSlotRuleDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  // 7 days x 10 windows is far past anything an operator would hand-build.
  @ArrayMaxSize(70)
  @Type(() => PlanSlotDto)
  fallbackSlots?: PlanSlotDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(24)
  maxPerDay?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(720)
  minGapMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10080)
  minLeadMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(52)
  horizonWeeks?: number;
}
