import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateTriggerRuleDto } from './create-trigger-rule.dto';

function errorsFor(obj: unknown) {
  return validate(plainToInstance(CreateTriggerRuleDto, obj), {
    whitelist: true,
  });
}

const base = { rule_name: 'My rule', target_format: 'score_mover' };

describe('CreateTriggerRuleDto (discriminated trigger_config validation)', () => {
  it('accepts a well-formed score_movement rule', async () => {
    expect(
      await errorsFor({
        ...base,
        trigger_type: 'score_movement',
        trigger_config: {
          min_delta_points: 5,
          direction: 'both',
          lookback_days: 90,
          geography: 'metro',
        },
      }),
    ).toHaveLength(0);
  });

  it('accepts rank_change and threshold_cross shapes', async () => {
    expect(
      await errorsFor({
        ...base,
        target_format: 'top_10_ranking',
        trigger_type: 'rank_change',
        trigger_config: {
          min_rank_delta: 5,
          direction: 'up',
          geography: 'metro',
          top_n: 50,
        },
      }),
    ).toHaveLength(0);
    expect(
      await errorsFor({
        ...base,
        target_format: 'grade_reveal',
        trigger_type: 'threshold_cross',
        trigger_config: {
          threshold_value: 50,
          direction: 'up',
          metric: 'propertyiq_score',
        },
      }),
    ).toHaveLength(0);
  });

  it('rejects a score_movement config missing lookback_days (discriminated)', async () => {
    const errs = await errorsFor({
      ...base,
      trigger_type: 'score_movement',
      trigger_config: {
        min_delta_points: 5,
        direction: 'both',
        geography: 'metro',
      },
    });
    expect(errs.some((e) => e.property === 'trigger_config')).toBe(true);
  });

  it('rejects an out-of-range lookback_days (bounds)', async () => {
    const errs = await errorsFor({
      ...base,
      trigger_type: 'score_movement',
      trigger_config: {
        min_delta_points: 5,
        direction: 'both',
        lookback_days: 400,
        geography: 'metro',
      },
    });
    expect(errs.some((e) => e.property === 'trigger_config')).toBe(true);
  });

  it('rejects a config whose shape does not match trigger_type', async () => {
    const errs = await errorsFor({
      ...base,
      trigger_type: 'score_movement',
      trigger_config: {
        threshold_value: 50,
        direction: 'up',
        metric: 'propertyiq_score',
      },
    });
    expect(errs.some((e) => e.property === 'trigger_config')).toBe(true);
  });

  it('rejects an unknown target_format and an over-long rule_name', async () => {
    expect(
      (
        await errorsFor({
          ...base,
          target_format: 'not_a_format',
          trigger_type: 'threshold_cross',
          trigger_config: {
            threshold_value: 50,
            direction: 'up',
            metric: 'propertyiq_score',
          },
        })
      ).some((e) => e.property === 'target_format'),
    ).toBe(true);
    expect(
      (
        await errorsFor({
          ...base,
          rule_name: 'x'.repeat(121),
          trigger_type: 'threshold_cross',
          trigger_config: {
            threshold_value: 50,
            direction: 'up',
            metric: 'propertyiq_score',
          },
        })
      ).some((e) => e.property === 'rule_name'),
    ).toBe(true);
  });
});
