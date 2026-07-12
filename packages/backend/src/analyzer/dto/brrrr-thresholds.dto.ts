/**
 * Validation DTO for user BRRRR grading-rubric overrides.
 *
 * Mirrors `BrrrrThresholds` from @propertyiq/analyzer-core. Same invariants
 * as the B&H and F&F threshold DTOs:
 *   1. A/B/C/D follow the metric's `direction`.
 *   2. Weights across the 5 metric keys sum to 100 ± 0.01.
 */
import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  Max,
  Min,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { MetricThresholdDto } from './user-thresholds.dto';
import { BrrrrAutoKillsDto } from './auto-kill-config.dto';

const NUM_OPTS = { allowNaN: false, allowInfinity: false } as const;

export class BrrrrWeightsDto {
  @IsNumber(NUM_OPTS) @Min(0) @Max(100) cash_left_in_deal!: number;
  @IsNumber(NUM_OPTS) @Min(0) @Max(100) all_in_to_arv_ratio!: number;
  @IsNumber(NUM_OPTS) @Min(0) @Max(100) post_refi_dscr!: number;
  @IsNumber(NUM_OPTS) @Min(0) @Max(100) post_refi_cash_flow_per_door!: number;
  @IsNumber(NUM_OPTS) @Min(0) @Max(100) time_to_refinance_months!: number;
}

@ValidatorConstraint({ name: 'brrrrWeightsSumToHundred', async: false })
class BrrrrWeightsSumToHundredConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const obj = args.object as BrrrrThresholdsDto;
    const w = obj.weights;
    if (!w) return true;
    const sum =
      (w.cash_left_in_deal ?? 0) +
      (w.all_in_to_arv_ratio ?? 0) +
      (w.post_refi_dscr ?? 0) +
      (w.post_refi_cash_flow_per_door ?? 0) +
      (w.time_to_refinance_months ?? 0);
    return Math.abs(sum - 100) <= 0.01;
  }
  defaultMessage(): string {
    return 'weights must sum to 100 (±0.01)';
  }
}

export class BrrrrThresholdsDto {
  @ValidateNested()
  @Type(() => MetricThresholdDto)
  cash_left_in_deal!: MetricThresholdDto;

  @ValidateNested()
  @Type(() => MetricThresholdDto)
  all_in_to_arv_ratio!: MetricThresholdDto;

  @ValidateNested()
  @Type(() => MetricThresholdDto)
  post_refi_dscr!: MetricThresholdDto;

  @ValidateNested()
  @Type(() => MetricThresholdDto)
  post_refi_cash_flow_per_door!: MetricThresholdDto;

  @ValidateNested()
  @Type(() => MetricThresholdDto)
  time_to_refinance_months!: MetricThresholdDto;

  @ValidateNested()
  @Type(() => BrrrrWeightsDto)
  @Validate(BrrrrWeightsSumToHundredConstraint)
  weights!: BrrrrWeightsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BrrrrAutoKillsDto)
  autoKills?: BrrrrAutoKillsDto;
}
