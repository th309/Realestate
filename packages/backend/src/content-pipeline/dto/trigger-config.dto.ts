import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const DIRECTIONS = ['up', 'down', 'both'] as const;
const GEOS = ['state', 'metro', 'county', 'zip'] as const;

/**
 * Bounded superset of the three auto-ideation trigger configs (score_movement,
 * rank_change, threshold_cross — see trigger-rule.types.ts). Every field is
 * optional + bounded so @ValidateNested + whitelist strips unknown keys and
 * rejects out-of-range values; which fields are REQUIRED for a given
 * trigger_type is enforced by TriggerConfigMatchesType below.
 */
export class TriggerConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99)
  min_delta_points?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(99)
  min_rank_delta?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  top_n?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  lookback_days?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(99)
  threshold_value?: number;

  @IsOptional()
  @IsIn(DIRECTIONS as unknown as string[])
  direction?: string;

  @IsOptional()
  @IsIn(GEOS as unknown as string[])
  geography?: string;

  @IsOptional()
  @IsIn(['propertyiq_score'])
  metric?: string;
}

/**
 * Discriminates trigger_config by the sibling trigger_type: the config must carry
 * the fields that trigger's RPC needs. Reads the parent object via Validation
 * arguments. When trigger_type is absent (the PATCH path may omit it) the check
 * is skipped — the field bounds above still apply and the evaluator guards NaN.
 */
@ValidatorConstraint({ name: 'triggerConfigMatchesType', async: false })
export class TriggerConfigMatchesType implements ValidatorConstraintInterface {
  validate(config: unknown, args: ValidationArguments): boolean {
    const type = (args.object as { trigger_type?: string }).trigger_type;
    if (!type) return true;
    const c = (config ?? {}) as Record<string, unknown>;
    const dir = c.direction as string;
    if (type === 'score_movement') {
      return (
        typeof c.min_delta_points === 'number' &&
        DIRECTIONS.includes(dir as (typeof DIRECTIONS)[number]) &&
        Number.isInteger(c.lookback_days) &&
        GEOS.includes(c.geography as (typeof GEOS)[number])
      );
    }
    if (type === 'rank_change') {
      return (
        Number.isInteger(c.min_rank_delta) &&
        DIRECTIONS.includes(dir as (typeof DIRECTIONS)[number]) &&
        GEOS.includes(c.geography as (typeof GEOS)[number]) &&
        Number.isInteger(c.top_n)
      );
    }
    if (type === 'threshold_cross') {
      return (
        typeof c.threshold_value === 'number' &&
        (dir === 'up' || dir === 'down') &&
        c.metric === 'propertyiq_score'
      );
    }
    return false;
  }

  defaultMessage(): string {
    return 'trigger_config is missing required fields for the given trigger_type';
  }
}
