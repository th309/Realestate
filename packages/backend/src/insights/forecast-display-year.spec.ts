import { forecastDisplayYear } from './forecast-display-year';

describe('forecastDisplayYear rolls the display year forward from October', () => {
  it('returns the same year for a September date', () => {
    expect(forecastDisplayYear(new Date('2026-09-30T00:00:00Z'))).toBe(2026);
  });

  it('returns the next year for an October date', () => {
    expect(forecastDisplayYear(new Date('2026-10-01T00:00:00Z'))).toBe(2027);
  });

  it('returns the next year for a December date', () => {
    expect(forecastDisplayYear(new Date('2026-12-15T00:00:00Z'))).toBe(2027);
  });

  it('returns the same year for a January date', () => {
    expect(forecastDisplayYear(new Date('2027-01-15T00:00:00Z'))).toBe(2027);
  });
});
