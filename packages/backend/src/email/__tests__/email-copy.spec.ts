import { SCORE_DESCRIPTION, SCORES_ACCURACY_PATH } from '@propertyiq/emails';

describe('SCORE_DESCRIPTION reflects the current PropertyIQ methodology', () => {
  it('describes four demand signals sourced from Zillow + Realtor', () => {
    expect(SCORE_DESCRIPTION).toMatch(/four/i);
    expect(SCORE_DESCRIPTION).toMatch(/Zillow/);
    expect(SCORE_DESCRIPTION).toMatch(/Realtor/);
  });

  it('does NOT reference the retired Redfin 3-metric formula', () => {
    expect(SCORE_DESCRIPTION).not.toMatch(/Redfin/i);
    expect(SCORE_DESCRIPTION).not.toMatch(/months of supply/i);
    expect(SCORE_DESCRIPTION).not.toMatch(/sold above list/i);
  });

  it('exposes the accuracy page path for linking instead of hardcoded stats', () => {
    expect(SCORES_ACCURACY_PATH).toBe('/scores/accuracy');
    expect(SCORE_DESCRIPTION).not.toMatch(/\$18,?100/);
    expect(SCORE_DESCRIPTION).not.toMatch(/100% (year )?hit rate/i);
  });
});
