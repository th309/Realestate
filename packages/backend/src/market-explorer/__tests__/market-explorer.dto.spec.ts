import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ScopeQueryDto } from '../market-explorer.dto';

describe('ScopeQueryDto', () => {
  it('accepts a valid metro-in-state query', async () => {
    const dto = plainToInstance(ScopeQueryDto, {
      parentLevel: 'state',
      parentId: '48',
      months: '120',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.months).toBe(120); // transformed to number
  });

  it('rejects months above the 120 cap', async () => {
    const dto = plainToInstance(ScopeQueryDto, {
      months: '999',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'months')).toBe(true);
  });

  it('rejects an unknown parentLevel', async () => {
    const dto = plainToInstance(ScopeQueryDto, {
      parentLevel: 'planet',
      months: '12',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'parentLevel')).toBe(true);
  });
});
