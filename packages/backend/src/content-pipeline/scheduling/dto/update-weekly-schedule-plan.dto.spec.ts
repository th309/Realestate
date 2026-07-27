import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  PlanSlotDto,
  PostTypeSlotRuleDto,
  UpdateWeeklySchedulePlanDto,
} from './update-weekly-schedule-plan.dto';

describe('UpdateWeeklySchedulePlanDto', () => {
  it('accepts a well-formed partial update (just the kill switch)', async () => {
    const dto = plainToInstance(UpdateWeeklySchedulePlanDto, {
      enabled: false,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts a schedulable post type in a rule', async () => {
    const dto = plainToInstance(UpdateWeeklySchedulePlanDto, {
      rules: [
        {
          postType: 'linkedin_post',
          slots: [{ weekday: 1, hour: 9, minute: 0 }],
        },
      ],
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects video_script — it can never be scheduled', async () => {
    const dto = plainToInstance(UpdateWeeklySchedulePlanDto, {
      rules: [
        {
          postType: 'video_script',
          slots: [{ weekday: 1, hour: 9, minute: 0 }],
        },
      ],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects an unknown post type', async () => {
    const dto = plainToInstance(UpdateWeeklySchedulePlanDto, {
      rules: [
        {
          postType: 'not_a_real_post_type',
          slots: [{ weekday: 1, hour: 9, minute: 0 }],
        },
      ],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('PlanSlotDto bounds', () => {
  it.each([
    ['weekday', { weekday: 7, hour: 9, minute: 0 }],
    ['weekday negative', { weekday: -1, hour: 9, minute: 0 }],
    ['hour', { weekday: 1, hour: 24, minute: 0 }],
    ['minute', { weekday: 1, hour: 9, minute: 60 }],
    ['non-integer hour', { weekday: 1, hour: 9.5, minute: 0 }],
  ])('rejects an out-of-range %s', async (_label, bad) => {
    const dto = plainToInstance(PlanSlotDto, bad);
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts every in-range boundary value', async () => {
    const dto = plainToInstance(PlanSlotDto, {
      weekday: 6,
      hour: 23,
      minute: 59,
    });
    expect(await validate(dto)).toHaveLength(0);
  });
});

describe('PostTypeSlotRuleDto slot array cap', () => {
  it('rejects more than 28 slots for one type', async () => {
    const tooMany = Array.from({ length: 29 }, (_, i) => ({
      weekday: i % 7,
      hour: 9,
      minute: 0,
    }));
    const dto = plainToInstance(PostTypeSlotRuleDto, {
      postType: 'linkedin_post',
      slots: tooMany,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
