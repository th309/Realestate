/**
 * Validation DTO for user Fix & Flip grading-rubric overrides.
 *
 * Mirrors `FixAndFlipThresholds` from @propertyiq/analyzer-core. Same two
 * invariants as the B&H UserThresholdsDto:
 *   1. A/B/C/D follow the metric's `direction` (decreasing for higher_is_better).
 *   2. Weights across the 5 metric keys sum to 100 ± 0.01.
 */
import { Type } from 'class-transformer';
import {
  IsNumber,
  Max,
  Min,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { MetricThresholdDto } from './user-thresholds.dto';

const NUM_OPTS = { allowNaN: false, allowInfinity: false } as const;

export class FixAndFlipWeightsDto {
  @IsNumber(NUM_OPTS) @Min(0) @Max(100) purchase_margin!: number;
  @IsNumber(NUM_OPTS) @Min(0) @Max(100) net_profit_margin!: number;
  @IsNumber(NUM_OPTS) @Min(0) @Max(100) cash_on_cash_roi!: number;
  @IsNumber(NUM_OPTS) @Min(0) @Max(100) annualized_roi!: number;
  @IsNumber(NUM_OPTS) @Min(0) @Max(100) net_profit_dollar!: number;
}

@ValidatorConstraint({ name: 'flipWeightsSumToHundred', async: false })
class FlipWeightsSumToHundredConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const obj = args.object as FixAndFlipThresholdsDto;
    const w = obj.weights;
    if (!w) return true;
    const sum =
      (w.purchase_margin ?? 0) +
      (w.net_profit_margin ?? 0) +
      (w.cash_on_cash_roi ?? 0) +
      (w.annualized_roi ?? 0) +
      (w.net_profit_dollar ?? 0);
    return Math.abs(sum - 100) <= 0.01;
  }
  defaultMessage(): string {
    return 'weights must sum to 100 (±0.01)';
  }
}

export class FixAndFlipThresholdsDto {
  @ValidateNested()
  @Type(() => MetricThresholdDto)
  purchase_margin!: MetricThresholdDto;

  @ValidateNested()
  @Type(() => MetricThresholdDto)
  net_profit_margin!: MetricThresholdDto;

  @ValidateNested()
  @Type(() => MetricThresholdDto)
  cash_on_cash_roi!: MetricThresholdDto;

  @ValidateNested()
  @Type(() => MetricThresholdDto)
  annualized_roi!: MetricThresholdDto;

  @ValidateNested()
  @Type(() => MetricThresholdDto)
  net_profit_dollar!: MetricThresholdDto;

  @ValidateNested()
  @Type(() => FixAndFlipWeightsDto)
  @Validate(FlipWeightsSumToHundredConstraint)
  weights!: FixAndFlipWeightsDto;
}
