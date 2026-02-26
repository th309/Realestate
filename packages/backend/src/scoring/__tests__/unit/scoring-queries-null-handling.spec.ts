/**
 * Scoring Queries — Null Handling Unit Tests
 *
 * Verifies that getScoreForDate() correctly returns null for missing score types
 * instead of coercing them to { score: 0, grade: 'F' }.
 *
 * Context: P3 data-accuracy fix — null-to-zero score coercion bug.
 * When only some score types exist in the DB (e.g. only homeready and investoredge),
 * the missing type (markethealth) must be returned as null, not as a zero score.
 */

import { getScoreForDate } from '../../scoring-queries';

// ---------------------------------------------------------------------------
// Supabase mock builder
// ---------------------------------------------------------------------------

/**
 * Creates a chainable mock that mimics the Supabase PostgREST builder.
 * Resolves with the provided `rows` when the chain terminates.
 */
function buildSupabaseMock(rows: Record<string, any>[] | null) {
  const chain: any = {};
  const self = () => chain;
  chain.from = jest.fn().mockReturnValue(chain);
  chain.select = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.ilike = jest.fn().mockReturnValue(chain);
  // Terminal — resolves with { data }
  chain.then = (resolve: (v: any) => void) => resolve({ data: rows });
  // Make it thenable so `await query` works
  Object.defineProperty(chain, Symbol.toStringTag, { value: 'Promise' });
  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getScoreForDate — null handling for missing score types', () => {
  it('returns null for missing score types instead of zero', async () => {
    // DB has homeready and investoredge, but NOT markethealth
    const rows = [
      {
        score_type: 'homeready',
        score: 72,
        grade: 'C+',
        confidence: 0.85,
        confidence_level: 'B',
        location_name: 'Dallas-Fort Worth, TX',
        median_price: 350000,
        z_scores: { zhvi: -0.4 },
        return_1y: 0.05,
        return_3y_ann: 0.03,
      },
      {
        score_type: 'investoredge',
        score: 65,
        grade: 'D',
        confidence: 0.78,
        confidence_level: 'B',
        location_name: 'Dallas-Fort Worth, TX',
        median_price: 350000,
        z_scores: null,
      },
    ];

    const supabase = buildSupabaseMock(rows);
    const result = await getScoreForDate(
      supabase,
      '19124',
      'metro',
      '2025-01-01',
    );

    expect(result).not.toBeNull();
    // Present types have actual scores
    expect(result!.scores.homeready).toEqual({
      score: 72,
      grade: 'C+',
      confidence: 0.85,
      confidence_level: 'B',
    });
    expect(result!.scores.investoredge).toEqual({
      score: 65,
      grade: 'D',
      confidence: 0.78,
      confidence_level: 'B',
    });
    // Missing type MUST be null — not { score: 0, grade: 'F' }
    expect(result!.scores.markethealth).toBeNull();
  });

  it('returns actual score data when all three types are present', async () => {
    const rows = [
      {
        score_type: 'homeready',
        score: 82,
        grade: 'B-',
        confidence: 0.92,
        confidence_level: 'A',
        location_name: 'Austin, TX',
        median_price: 420000,
        z_scores: { zhvi: 0.3 },
        return_1y: 0.08,
        return_3y_ann: 0.06,
      },
      {
        score_type: 'investoredge',
        score: 55,
        grade: 'D-',
        confidence: 0.71,
        confidence_level: 'B',
        location_name: 'Austin, TX',
        median_price: 420000,
      },
      {
        score_type: 'markethealth',
        score: 68,
        grade: 'D+',
        confidence: 0.65,
        confidence_level: 'C',
        location_name: 'Austin, TX',
        median_price: 420000,
      },
    ];

    const supabase = buildSupabaseMock(rows);
    const result = await getScoreForDate(
      supabase,
      '12420',
      'metro',
      '2025-01-01',
    );

    expect(result).not.toBeNull();
    expect(result!.scores.homeready).not.toBeNull();
    expect(result!.scores.homeready!.score).toBe(82);
    expect(result!.scores.investoredge).not.toBeNull();
    expect(result!.scores.investoredge!.score).toBe(55);
    expect(result!.scores.markethealth).not.toBeNull();
    expect(result!.scores.markethealth!.score).toBe(68);
  });

  it('returns null when no rows exist at all', async () => {
    const supabase = buildSupabaseMock([]);
    const result = await getScoreForDate(
      supabase,
      '99999',
      'metro',
      '2025-01-01',
    );

    expect(result).toBeNull();
  });

  it('returns null when data is null (Supabase error path)', async () => {
    const supabase = buildSupabaseMock(null);
    const result = await getScoreForDate(
      supabase,
      '99999',
      'metro',
      '2025-01-01',
    );

    expect(result).toBeNull();
  });

  it('normalizes legacy confidence_level values in returned scores', async () => {
    const rows = [
      {
        score_type: 'homeready',
        score: 70,
        grade: 'C-',
        confidence: 0.8,
        confidence_level: 'HIGH', // Legacy format
        location_name: 'Test Market',
        median_price: 300000,
      },
      {
        score_type: 'investoredge',
        score: 45,
        grade: 'F',
        confidence: 0.5,
        confidence_level: 'INSUFFICIENT', // Legacy format
        location_name: 'Test Market',
        median_price: 300000,
      },
    ];

    const supabase = buildSupabaseMock(rows);
    const result = await getScoreForDate(
      supabase,
      '11111',
      'metro',
      '2025-01-01',
    );

    expect(result).not.toBeNull();
    expect(result!.scores.homeready!.confidence_level).toBe('A'); // HIGH -> A
    expect(result!.scores.investoredge!.confidence_level).toBe('F'); // INSUFFICIENT -> F
  });

  it('uses numeric locationId for .eq() and string locationId for .ilike()', async () => {
    const rows = [
      {
        score_type: 'homeready',
        score: 60,
        grade: 'D-',
        confidence: 0.6,
        confidence_level: 'B',
        location_name: 'Somewhere, USA',
        median_price: 250000,
      },
    ];

    // For numeric ID — should use .eq()
    const numericMock = buildSupabaseMock(rows);
    await getScoreForDate(numericMock, '31080', 'metro', '2025-01-01');
    expect(numericMock.eq).toHaveBeenCalledWith('location_id', '31080');

    // For string ID — should use .ilike()
    const stringMock = buildSupabaseMock(rows);
    await getScoreForDate(stringMock, 'Dallas', 'metro', '2025-01-01');
    expect(stringMock.ilike).toHaveBeenCalledWith('location_name', 'Dallas%');
  });

  it('populates metadata fields from the first available row', async () => {
    const rows = [
      {
        score_type: 'markethealth',
        score: 50,
        grade: 'F',
        confidence: 0.5,
        confidence_level: 'C',
        location_name: 'Kansas City, KS',
        median_price: 280000,
        z_scores: { unemployment_rate: 0.1 },
        return_1y: 0.04,
        return_3y_ann: 0.02,
      },
    ];

    const supabase = buildSupabaseMock(rows);
    const result = await getScoreForDate(
      supabase,
      '28140',
      'metro',
      '2025-01-01',
    );

    expect(result).not.toBeNull();
    expect(result!.location_name).toBe('Kansas City, KS');
    expect(result!.median_price).toBe(280000);
    expect(result!.z_scores).toEqual({ unemployment_rate: 0.1 });
    expect(result!.return_1y).toBe(0.04);
    expect(result!.return_3y_ann).toBe(0.02);
    // The other two score types should be null
    expect(result!.scores.homeready).toBeNull();
    expect(result!.scores.investoredge).toBeNull();
  });
});
