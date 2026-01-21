import { describe, it, expect } from 'vitest';
import {
  formatValue,
  formatCurrency,
  formatCurrencyAbbreviated,
  formatPercent,
  formatNumber,
  formatDecimal,
  formatYears,
  formatDays,
  formatRatio,
  formatIndex,
  formatChange,
  getTrendColor,
} from '../formatters';

describe('formatCurrency', () => {
  it('formats 425000 as $425,000', () => {
    expect(formatCurrency(425000, 0)).toBe('$425,000');
  });

  it('formats 0 as $0', () => {
    expect(formatCurrency(0, 0)).toBe('$0');
  });

  it('formats negative values correctly', () => {
    expect(formatCurrency(-50000, 0)).toBe('-$50,000');
  });

  it('respects precision for decimal values', () => {
    expect(formatCurrency(425000.5, 2)).toBe('$425,000.50');
  });

  it('returns N/A for NaN', () => {
    expect(formatCurrency(NaN, 0)).toBe('N/A');
  });

  it('formats large numbers with commas', () => {
    expect(formatCurrency(1234567890, 0)).toBe('$1,234,567,890');
  });
});

describe('formatCurrencyAbbreviated', () => {
  it('formats 15000000 as $15.0M', () => {
    expect(formatCurrencyAbbreviated(15000000, 1)).toBe('$15.0M');
  });

  it('formats 1500000000 as $1.5B', () => {
    expect(formatCurrencyAbbreviated(1500000000, 1)).toBe('$1.5B');
  });

  it('formats 1500 as $1.5K', () => {
    expect(formatCurrencyAbbreviated(1500, 1)).toBe('$1.5K');
  });

  it('formats small values without abbreviation', () => {
    expect(formatCurrencyAbbreviated(999, 0)).toBe('$999');
  });

  it('handles negative values', () => {
    expect(formatCurrencyAbbreviated(-5000000, 1)).toBe('-$5.0M');
  });

  it('returns N/A for NaN', () => {
    expect(formatCurrencyAbbreviated(NaN, 1)).toBe('N/A');
  });
});

describe('formatPercent', () => {
  it('formats 5.25 as 5.25%', () => {
    expect(formatPercent(5.25, 2)).toBe('5.25%');
  });

  it('formats negative values as -3.20%', () => {
    expect(formatPercent(-3.2, 2)).toBe('-3.20%');
  });

  it('formats 0 as 0.00%', () => {
    expect(formatPercent(0, 2)).toBe('0.00%');
  });

  it('respects precision parameter', () => {
    expect(formatPercent(5.256, 1)).toBe('5.3%');
  });

  it('returns N/A for NaN', () => {
    expect(formatPercent(NaN, 2)).toBe('N/A');
  });
});

describe('formatNumber', () => {
  it('formats 1234567 as 1,234,567', () => {
    expect(formatNumber(1234567, 0)).toBe('1,234,567');
  });

  it('formats 0 as 0', () => {
    expect(formatNumber(0, 0)).toBe('0');
  });

  it('formats with decimal precision', () => {
    expect(formatNumber(1234.567, 2)).toBe('1,234.57');
  });

  it('returns N/A for NaN', () => {
    expect(formatNumber(NaN, 0)).toBe('N/A');
  });
});

describe('formatDecimal', () => {
  it('formats 3.14159 with precision 2 as 3.14', () => {
    expect(formatDecimal(3.14159, 2)).toBe('3.14');
  });

  it('formats integer with trailing zeros', () => {
    expect(formatDecimal(5, 2)).toBe('5.00');
  });

  it('returns N/A for NaN', () => {
    expect(formatDecimal(NaN, 2)).toBe('N/A');
  });
});

describe('formatYears', () => {
  it('formats 5.5 with precision 1 as 5.5', () => {
    expect(formatYears(5.5, 1)).toBe('5.5');
  });

  it('formats 1 with precision 0 as 1', () => {
    expect(formatYears(1, 0)).toBe('1');
  });

  it('returns N/A for NaN', () => {
    expect(formatYears(NaN, 1)).toBe('N/A');
  });
});

describe('formatDays', () => {
  it('formats 28 with precision 0 as 28', () => {
    expect(formatDays(28, 0)).toBe('28');
  });

  it('formats 1 with precision 0 as 1', () => {
    expect(formatDays(1, 0)).toBe('1');
  });

  it('returns N/A for NaN', () => {
    expect(formatDays(NaN, 0)).toBe('N/A');
  });
});

describe('formatRatio', () => {
  it('formats 0.95 with precision 2 as 0.95', () => {
    expect(formatRatio(0.95, 2)).toBe('0.95');
  });

  it('formats 1.02 with precision 2 as 1.02', () => {
    expect(formatRatio(1.02, 2)).toBe('1.02');
  });

  it('returns N/A for NaN', () => {
    expect(formatRatio(NaN, 2)).toBe('N/A');
  });
});

describe('formatIndex', () => {
  it('formats 100.5 with precision 1 as 100.5', () => {
    expect(formatIndex(100.5, 1)).toBe('100.5');
  });

  it('formats 85 with precision 1 as 85.0', () => {
    expect(formatIndex(85, 1)).toBe('85.0');
  });

  it('returns N/A for NaN', () => {
    expect(formatIndex(NaN, 1)).toBe('N/A');
  });
});

describe('formatValue', () => {
  it('formats currency values correctly', () => {
    expect(formatValue(425000, { format: 'currency', precision: 0 })).toBe('$425,000');
  });

  it('formats percent values correctly', () => {
    expect(formatValue(5.25, { format: 'percent', precision: 2 })).toBe('5.25%');
  });

  it('formats number values correctly', () => {
    expect(formatValue(1234567, { format: 'number', precision: 0 })).toBe('1,234,567');
  });

  it('formats days values correctly', () => {
    expect(formatValue(28, { format: 'days', precision: 0 })).toBe('28');
  });

  it('applies prefix correctly', () => {
    expect(formatValue(100, { format: 'decimal', precision: 0, prefix: '~' })).toBe('~100');
  });

  it('applies suffix correctly', () => {
    expect(formatValue(28, { format: 'days', precision: 0, suffix: ' days' })).toBe('28 days');
  });

  it('applies both prefix and suffix', () => {
    expect(formatValue(5, { format: 'decimal', precision: 1, prefix: '~', suffix: 'x' })).toBe('~5.0x');
  });

  it('returns N/A for null', () => {
    expect(formatValue(null, { format: 'currency', precision: 0 })).toBe('N/A');
  });

  it('returns N/A for undefined', () => {
    expect(formatValue(undefined, { format: 'currency', precision: 0 })).toBe('N/A');
  });

  it('returns N/A for NaN', () => {
    expect(formatValue(NaN, { format: 'currency', precision: 0 })).toBe('N/A');
  });
});

describe('formatChange', () => {
  it('formats positive change with plus sign', () => {
    const result = formatChange(5.2, 1);
    expect(result.formatted).toBe('+5.2%');
    expect(result.direction).toBe('up');
  });

  it('formats negative change without plus sign', () => {
    const result = formatChange(-3.1, 1);
    expect(result.formatted).toBe('-3.1%');
    expect(result.direction).toBe('down');
  });

  it('formats zero change as neutral', () => {
    const result = formatChange(0, 1);
    expect(result.formatted).toBe('0.0%');
    expect(result.direction).toBe('neutral');
  });

  it('returns N/A and neutral for null', () => {
    const result = formatChange(null, 1);
    expect(result.formatted).toBe('N/A');
    expect(result.direction).toBe('neutral');
  });

  it('returns N/A and neutral for undefined', () => {
    const result = formatChange(undefined, 1);
    expect(result.formatted).toBe('N/A');
    expect(result.direction).toBe('neutral');
  });

  it('returns N/A and neutral for NaN', () => {
    const result = formatChange(NaN, 1);
    expect(result.formatted).toBe('N/A');
    expect(result.direction).toBe('neutral');
  });
});

describe('getTrendColor', () => {
  describe('with red-green color scale (up is good)', () => {
    it('returns green for up direction', () => {
      expect(getTrendColor('up', 'red-green')).toBe('text-green-600');
    });

    it('returns red for down direction', () => {
      expect(getTrendColor('down', 'red-green')).toBe('text-red-600');
    });

    it('returns gray for neutral direction', () => {
      expect(getTrendColor('neutral', 'red-green')).toBe('text-gray-500');
    });
  });

  describe('with green-red color scale (down is good)', () => {
    it('returns red for up direction', () => {
      expect(getTrendColor('up', 'green-red')).toBe('text-red-600');
    });

    it('returns green for down direction', () => {
      expect(getTrendColor('down', 'green-red')).toBe('text-green-600');
    });

    it('returns gray for neutral direction', () => {
      expect(getTrendColor('neutral', 'green-red')).toBe('text-gray-500');
    });
  });

  describe('with neutral color scale', () => {
    it('returns gray for any direction', () => {
      expect(getTrendColor('up', 'neutral')).toBe('text-gray-500');
      expect(getTrendColor('down', 'neutral')).toBe('text-gray-500');
      expect(getTrendColor('neutral', 'neutral')).toBe('text-gray-500');
    });
  });

  describe('with default color scale', () => {
    it('defaults to red-green behavior', () => {
      expect(getTrendColor('up')).toBe('text-green-600');
      expect(getTrendColor('down')).toBe('text-red-600');
    });
  });
});
