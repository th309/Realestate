import { forecastDisplayYear } from './forecast-display-year';

describe('forecastDisplayYear rolls the display year forward from October', () => {
  it('returns the same year for a September date', () => {
    expect(forecastDisplayYear('2026-09-30')).toBe(2026);
  });

  it('returns the next year for an October date', () => {
    expect(forecastDisplayYear('2026-10-01')).toBe(2027);
  });

  it('returns the next year for a December date', () => {
    expect(forecastDisplayYear('2026-12-15')).toBe(2027);
  });

  it('returns the same year for a January date', () => {
    expect(forecastDisplayYear('2027-01-15')).toBe(2027);
  });

  it('falls back to a current-date-derived year for null or invalid input', () => {
    const now = new Date();
    const expected =
      now.getUTCMonth() >= 9 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
    expect(forecastDisplayYear(null)).toBe(expected);
    expect(forecastDisplayYear('not-a-date')).toBe(expected);
  });
});
