import { batchInsightTypesFor } from './insight-batch-generator';

describe('batchInsightTypesFor adds the forecast narrative only for metros', () => {
  it('includes market_forecast for metro', () => {
    expect(batchInsightTypesFor('metro')).toEqual([
      'market_take',
      'score_explanation',
      'market_forecast',
    ]);
  });

  it('excludes market_forecast for county and zip', () => {
    expect(batchInsightTypesFor('county')).toEqual([
      'market_take',
      'score_explanation',
    ]);
    expect(batchInsightTypesFor('zip')).toEqual([
      'market_take',
      'score_explanation',
    ]);
  });
});
