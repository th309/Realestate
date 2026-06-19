/**
 * State FIPS Normalization Unit Tests
 *
 * Verifies that normalizeStateRegionId() correctly resolves state identifiers
 * from FIPS codes, 2-letter abbreviations, and full names to canonical forms.
 *
 * Context: P3 data-accuracy fix — state-level queries (Zillow, Realtor) were
 * passing raw FIPS codes (e.g. '20') to tables keyed by abbreviation ('KS')
 * or name ('Kansas'), resulting in zero-row responses. The fix uses these
 * normalization functions to convert the incoming regionId before querying.
 */

import {
  normalizeStateRegionId,
  normalizeStateToCode,
  normalizeStateToFips,
  normalizeStateToName,
  normalizeCountyFips,
  normalizeCbsaCode,
  resolveRegionDisplayName,
  STATE_FIPS_TO_CODE,
  STATE_CODE_TO_FIPS,
} from '../geo';

// ---------------------------------------------------------------------------
// normalizeStateRegionId — the core resolver
// ---------------------------------------------------------------------------

describe('normalizeStateRegionId', () => {
  describe('FIPS code input', () => {
    it('normalizes 2-digit FIPS "20" to Kansas', () => {
      const result = normalizeStateRegionId('20');
      expect(result).not.toBeNull();
      expect(result!.stateCode).toBe('KS');
      expect(result!.stateFips).toBe('20');
      expect(result!.stateName).toBe('Kansas');
    });

    it('normalizes 2-digit FIPS "06" to California', () => {
      const result = normalizeStateRegionId('06');
      expect(result).not.toBeNull();
      expect(result!.stateCode).toBe('CA');
      expect(result!.stateFips).toBe('06');
      expect(result!.stateName).toBe('California');
    });

    it('normalizes 2-digit FIPS "36" to New York', () => {
      const result = normalizeStateRegionId('36');
      expect(result).not.toBeNull();
      expect(result!.stateCode).toBe('NY');
      expect(result!.stateFips).toBe('36');
      expect(result!.stateName).toBe('New York');
    });

    it('normalizes 1-digit FIPS "6" (no leading zero) to California', () => {
      const result = normalizeStateRegionId('6');
      expect(result).not.toBeNull();
      expect(result!.stateCode).toBe('CA');
      expect(result!.stateFips).toBe('06');
      expect(result!.stateName).toBe('California');
    });

    it('normalizes 1-digit FIPS "1" to Alabama', () => {
      const result = normalizeStateRegionId('1');
      expect(result).not.toBeNull();
      expect(result!.stateCode).toBe('AL');
      expect(result!.stateFips).toBe('01');
    });

    it('normalizes FIPS "72" to Puerto Rico', () => {
      const result = normalizeStateRegionId('72');
      expect(result).not.toBeNull();
      expect(result!.stateCode).toBe('PR');
      expect(result!.stateName).toBe('Puerto Rico');
    });
  });

  describe('2-letter state code input', () => {
    it('normalizes "FL" to Florida', () => {
      const result = normalizeStateRegionId('FL');
      expect(result).not.toBeNull();
      expect(result!.stateCode).toBe('FL');
      expect(result!.stateFips).toBe('12');
      expect(result!.stateName).toBe('Florida');
    });

    it('normalizes "TX" to Texas', () => {
      const result = normalizeStateRegionId('TX');
      expect(result).not.toBeNull();
      expect(result!.stateCode).toBe('TX');
      expect(result!.stateFips).toBe('48');
      expect(result!.stateName).toBe('Texas');
    });

    it('normalizes lowercase "ca" to California', () => {
      const result = normalizeStateRegionId('ca');
      expect(result).not.toBeNull();
      expect(result!.stateCode).toBe('CA');
      expect(result!.stateFips).toBe('06');
    });
  });

  describe('full state name input', () => {
    it('normalizes "Florida" to FL/12', () => {
      const result = normalizeStateRegionId('Florida');
      expect(result).not.toBeNull();
      expect(result!.stateCode).toBe('FL');
      expect(result!.stateFips).toBe('12');
    });

    it('normalizes "New York" (with space) correctly', () => {
      const result = normalizeStateRegionId('New York');
      expect(result).not.toBeNull();
      expect(result!.stateCode).toBe('NY');
      expect(result!.stateFips).toBe('36');
    });

    it('normalizes "District of Columbia" correctly', () => {
      const result = normalizeStateRegionId('District of Columbia');
      expect(result).not.toBeNull();
      expect(result!.stateCode).toBe('DC');
      expect(result!.stateFips).toBe('11');
    });

    it('normalizes case-insensitive "florida" correctly', () => {
      const result = normalizeStateRegionId('florida');
      expect(result).not.toBeNull();
      expect(result!.stateCode).toBe('FL');
    });
  });

  describe('edge cases', () => {
    it('returns null for empty string', () => {
      expect(normalizeStateRegionId('')).toBeNull();
    });

    it('returns null for whitespace-only string', () => {
      expect(normalizeStateRegionId('   ')).toBeNull();
    });

    it('returns null for unrecognized state name', () => {
      expect(normalizeStateRegionId('Narnia')).toBeNull();
    });

    it('trims whitespace from input', () => {
      const result = normalizeStateRegionId('  FL  ');
      expect(result).not.toBeNull();
      expect(result!.stateCode).toBe('FL');
    });
  });
});

// ---------------------------------------------------------------------------
// Convenience wrappers
// ---------------------------------------------------------------------------

describe('normalizeStateToCode', () => {
  it('returns 2-letter code from FIPS "20"', () => {
    expect(normalizeStateToCode('20')).toBe('KS');
  });

  it('returns 2-letter code from full name "California"', () => {
    expect(normalizeStateToCode('California')).toBe('CA');
  });

  it('returns original string when unrecognized', () => {
    expect(normalizeStateToCode('Narnia')).toBe('Narnia');
  });
});

describe('normalizeStateToFips', () => {
  it('returns 2-digit FIPS from code "TX"', () => {
    expect(normalizeStateToFips('TX')).toBe('48');
  });

  it('pads single-digit FIPS "6" to "06"', () => {
    expect(normalizeStateToFips('6')).toBe('06');
  });

  it('returns padded original for unknown input', () => {
    expect(normalizeStateToFips('XZ')).toBe('XZ');
  });
});

describe('normalizeStateToName', () => {
  it('returns full name from FIPS "12"', () => {
    expect(normalizeStateToName('12')).toBe('Florida');
  });

  it('returns full name from code "NY"', () => {
    expect(normalizeStateToName('NY')).toBe('New York');
  });
});

// ---------------------------------------------------------------------------
// resolveRegionDisplayName — user-facing region label (no raw-id leaks)
// ---------------------------------------------------------------------------

describe('resolveRegionDisplayName', () => {
  it('prefers an explicit location name when present', () => {
    expect(resolveRegionDisplayName('metro', '19740', 'Denver, CO')).toBe(
      'Denver, CO',
    );
  });

  it('trims an explicit location name', () => {
    expect(resolveRegionDisplayName('metro', '19740', '  Denver, CO  ')).toBe(
      'Denver, CO',
    );
  });

  it('resolves a state FIPS to its name instead of leaking "state 35"', () => {
    // Regression: the AI insight rendered "state 35 does not have enough data".
    expect(resolveRegionDisplayName('state', '35', null)).toBe('New Mexico');
    expect(resolveRegionDisplayName('state', '35', '')).toBe('New Mexico');
    expect(resolveRegionDisplayName('state', '35', '   ')).toBe('New Mexico');
  });

  it('returns a generic label for non-state geos without a name', () => {
    expect(resolveRegionDisplayName('zip', '90210', null)).toBe('This market');
    expect(resolveRegionDisplayName('county', '06037', undefined)).toBe(
      'This market',
    );
  });

  it('returns a national label for the national geo without a name', () => {
    expect(resolveRegionDisplayName('national', 'national', null)).toBe(
      'The national market',
    );
  });

  it('falls back to a generic label for an unrecognized state id', () => {
    expect(resolveRegionDisplayName('state', '99', null)).toBe('This market');
  });
});

// ---------------------------------------------------------------------------
// Coverage of all 51 FIPS entries (50 states + DC + PR)
// ---------------------------------------------------------------------------

describe('STATE_FIPS_TO_CODE completeness', () => {
  it('has a mapping for every expected state FIPS', () => {
    const expectedCount = 52; // 50 states + DC + PR
    expect(Object.keys(STATE_FIPS_TO_CODE).length).toBe(expectedCount);
  });

  it('has inverse mapping for every entry', () => {
    for (const [fips, code] of Object.entries(STATE_FIPS_TO_CODE)) {
      expect(STATE_CODE_TO_FIPS[code]).toBe(fips);
    }
  });
});

// ---------------------------------------------------------------------------
// County and CBSA normalization (non-state IDs should pass through unchanged)
// ---------------------------------------------------------------------------

describe('normalizeCountyFips', () => {
  it('pads 4-digit county FIPS "1731" to "01731"', () => {
    expect(normalizeCountyFips('1731')).toBe('01731');
  });

  it('leaves 5-digit county FIPS "17031" unchanged', () => {
    expect(normalizeCountyFips('17031')).toBe('17031');
  });

  it('trims whitespace', () => {
    expect(normalizeCountyFips(' 06037 ')).toBe('06037');
  });
});

describe('normalizeCbsaCode', () => {
  it('pads 4-digit CBSA "6980" to "06980"', () => {
    expect(normalizeCbsaCode('6980')).toBe('06980');
  });

  it('leaves 5-digit CBSA "16980" unchanged', () => {
    expect(normalizeCbsaCode('16980')).toBe('16980');
  });

  it('returns non-numeric metro name trimmed', () => {
    expect(normalizeCbsaCode('  Dallas  ')).toBe('Dallas');
  });
});
