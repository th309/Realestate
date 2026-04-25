import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ResolveRankingDto } from './resolve-ranking.dto';

describe('ResolveRankingDto', () => {
  const valid = {
    format: 'top_10_ranking',
    metric_id: 'piq_score',
    geo_level: 'metro',
    scope_type: 'national',
    scope_id: null,
  };

  it('passes for valid input', async () => {
    const errors = await validate(plainToInstance(ResolveRankingDto, valid));
    expect(errors).toHaveLength(0);
  });

  it('rejects unknown format', async () => {
    const errors = await validate(
      plainToInstance(ResolveRankingDto, { ...valid, format: 'foo' }),
    );
    expect(errors[0].constraints).toHaveProperty('isIn');
  });

  it('requires scope_id when scope_type !== national', async () => {
    const errors = await validate(
      plainToInstance(ResolveRankingDto, {
        ...valid,
        scope_type: 'state',
        scope_id: null,
      }),
    );
    expect(errors[0].property).toBe('scope_id');
  });

  it('rejects limit > 50', async () => {
    const errors = await validate(
      plainToInstance(ResolveRankingDto, { ...valid, limit: 100 }),
    );
    expect(errors[0].constraints).toHaveProperty('max');
  });
});
