/**
 * Validation DTO for user grading-rubric overrides.
 *
 * Mirrors the `UserThresholds` shape exported from `@propertyiq/analyzer-core`.
 * Two custom validators enforce semantic invariants the grading engine relies
 * on:
 *   1. MetricThresholdOrderingConstraint — A/B/C/D follow the metric's
 *      `direction` (strictly decreasing for higher_is_better, strictly
 *      increasing for lower_is_better).
 *   2. WeightsSumToHundredConstraint — the five weight fields sum to
 *      100 ± 0.01.
 */
import { Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  Max,
  Min,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

const NUM_OPTS = { allowNaN: false, allowInfinity: false } as const;

@ValidatorConstraint({ name: 'metricThresholdOrdering', async: false })
class MetricThresholdOrderingConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const obj = args.object as MetricThresholdDto;
    const { A, B, C, D, direction } = obj;
    if (
      typeof A !== 'number' ||
      typeof B !== 'number' ||
      typeof C !== 'number' ||
      typeof D !== 'number'
    ) {
      // Individual @IsNumber decorators will surface this.
      return true;
    }
    if (direction === 'higher_is_better') return A > B && B > C && C > D;
    if (direction === 'lower_is_better') return A < B && B < C && C < D;
    return false;
  }
  defaultMessage(args: ValidationArguments): string {
    const obj = args.object as MetricThresholdDto;
    return `A/B/C/D must be strictly ${obj.direction === 'lower_is_better' ? 'increasing' : 'decreasing'} for direction "${obj.direction}"`;
  }
}

export class MetricThresholdDto {
  @IsNumber(NUM_OPTS) A!: number;
  @IsNumber(NUM_OPTS) B!: number;
  @IsNumber(NUM_OPTS) C!: number;
  @IsNumber(NUM_OPTS) D!: number;
  @IsIn(['higher_is_better', 'lower_is_better'])
  direction!: 'higher_is_better' | 'lower_is_better';

  // class-validator runs class-level validators after property-level ones;
  // declaring it on any property is fine — the constraint reads the whole
  // object via ValidationArguments.object.
  @Validate(MetricThresholdOrderingConstraint)
  private readonly __ordering?: never;
}

export class WeightsDto {
  @IsNumber(NUM_OPTS) @Min(0) @Max(100) cashOnCash!: number;
  @IsNumber(NUM_OPTS) @Min(0) @Max(100) dscr!: number;
  @IsNumber(NUM_OPTS) @Min(0) @Max(100) cashFlowPerDoor!: number;
  @IsNumber(NUM_OPTS) @Min(0) @Max(100) capRate!: number;
  @IsNumber(NUM_OPTS) @Min(0) @Max(100) breakEvenOccupancy!: number;
}

@ValidatorConstraint({ name: 'weightsSumToHundred', async: false })
class WeightsSumToHundredConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const obj = args.object as UserThresholdsDto;
    const w = obj.weights;
    if (!w) return true; // ValidateNested will surface a missing weights block.
    const sum =
      (w.cashOnCash ?? 0) +
      (w.dscr ?? 0) +
      (w.cashFlowPerDoor ?? 0) +
      (w.capRate ?? 0) +
      (w.breakEvenOccupancy ?? 0);
    return Math.abs(sum - 100) <= 0.01;
  }
  defaultMessage(): string {
    return 'weights must sum to 100 (±0.01)';
  }
}

export class UserThresholdsDto {
  @ValidateNested()
  @Type(() => MetricThresholdDto)
  cashOnCash!: MetricThresholdDto;

  @ValidateNested()
  @Type(() => MetricThresholdDto)
  dscr!: MetricThresholdDto;

  @ValidateNested()
  @Type(() => MetricThresholdDto)
  cashFlowPerDoor!: MetricThresholdDto;

  @ValidateNested()
  @Type(() => MetricThresholdDto)
  capRate!: MetricThresholdDto;

  @ValidateNested()
  @Type(() => MetricThresholdDto)
  breakEvenOccupancy!: MetricThresholdDto;

  @ValidateNested()
  @Type(() => WeightsDto)
  @Validate(WeightsSumToHundredConstraint)
  weights!: WeightsDto;
}
