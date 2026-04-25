import { formatRankingValue } from './format-value';

describe('formatRankingValue', () => {
  it('formats currency values with M suffix', () => {
    expect(formatRankingValue(1_200_000, 'currency')).toBe('$1.2M');
  });

  it('formats currency values under 1M with K suffix', () => {
    expect(formatRankingValue(499_000, 'currency')).toBe('$499K');
  });

  it('formats currency values under 1K as whole dollars', () => {
    expect(formatRankingValue(850, 'currency')).toBe('$850');
  });

  it('formats percent (decimal input) as percentage string', () => {
    expect(formatRankingValue(0.124, 'percent')).toBe('12.4%');
  });

  it('formats percent_abs (already-percentage input) as percentage string', () => {
    expect(formatRankingValue(12.4, 'percent_abs')).toBe('12.4%');
  });

  it('formats days as "N days"', () => {
    expect(formatRankingValue(28, 'days')).toBe('28 days');
  });

  it('formats index as rounded integer string', () => {
    expect(formatRankingValue(87.3, 'index')).toBe('87');
  });

  it('formats number with K suffix', () => {
    expect(formatRankingValue(45_000, 'number')).toBe('45K');
  });

  it('formats number with M suffix', () => {
    expect(formatRankingValue(2_500_000, 'number')).toBe('2.5M');
  });
});
