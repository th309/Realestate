import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ScopeQueryDto } from '../market-explorer.dto';

describe('ScopeQueryDto', () => {
  it('accepts a valid metro-in-state query', async () => {
    const dto = plainToInstance(ScopeQueryDto, {
      parentLevel: 'state',
      parentId: '48',
      metric: 'propertyiq_score',
      months: '120',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.months).toBe(120); // transformed to number
  });

  it('rejects months above the 120 cap', async () => {
    const dto = plainToInstance(ScopeQueryDto, {
      metric: 'home_value',
      months: '999',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'months')).toBe(true);
  });

  it('rejects a missing metric', async () => {
    const dto = plainToInstance(ScopeQueryDto, { months: '12' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'metric')).toBe(true);
  });

  it('rejects an unknown parentLevel', async () => {
    const dto = plainToInstance(ScopeQueryDto, {
      parentLevel: 'planet',
      metric: 'home_value',
      months: '12',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'parentLevel')).toBe(true);
  });
});
