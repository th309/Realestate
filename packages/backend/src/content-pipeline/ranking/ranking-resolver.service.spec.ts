import {
  RankingResolverService,
  ResolveRankingInput,
  MIN_RANKINGS,
} from './ranking-resolver.service';
import { MetricResolutionService } from '../../metric-resolution/metric-resolution.service';
import { SupabaseService } from '../../supabase/supabase.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMetroRows(count: number, valueBase = 500_000) {
  return Array.from({ length: count }, (_, i) => ({
    cbsa_code: String(10000 + i),
    region_name: `Metro ${i}`,
    state_name: 'CA',
    value: valueBase - i * 1000,
    period_date: '2026-03-01',
  }));
}

type Row = Record<string, unknown>;

/**
 * Build a fully-chainable Supabase query builder mock.
 *
 * Strategy: every builder method returns `this` (the same object).
 * Terminal awaits resolve from a queue: first await → count result,
 * second await → ranked rows result.
 *
 * We expose named spies for the methods tests need to assert on.
 */
function buildHarness(opts: {
  supabaseRows?: Row[];
  crosswalkRows?: Row[];
  excludedCount?: number;
}) {
  const fetchRows: Row[] = opts.supabaseRows ?? makeMetroRows(10);
  const crosswalkRows: Row[] = opts.crosswalkRows ?? [];
  const excludedCount = opts.excludedCount ?? 2;

  // Spies tests assert on
  const inSpy = jest.fn();
  const gteSpy = jest.fn();
  const orderSpy = jest.fn();
  const notSpy = jest.fn();
  const eqSpy = jest.fn();
  const orSpy = jest.fn();
  const limitSpy = jest.fn();

  // We need three distinct terminal resolutions (in call order):
  //   1. geography_crosswalk lookup  → { data: crosswalkRows, error: null }
  //   2. countExcluded query         → { count: excludedCount, error: null }
  //   3. fetchRankedRows query        → { data: fetchRows, error: null }
  // Promise.all fires 2 & 3 in parallel after 1. The crosswalk only fires
  // for non-national scope. For national scope only 2 & 3 fire.
  //
  // We implement this by tracking `from()` call index: each `from()` call
  // returns a fresh builder that resolves to the next queued value when awaited.
  // Two source-table calls per resolve():
  //   1. countExcluded  → { count, error }
  //   2. fetchRankedRows → { data, error }
  const resolveQueue = [
    { count: excludedCount, error: null },
    { data: fetchRows, error: null },
  ];
  let queueIdx = 0;

  function makeBuilder(resolveValue: unknown) {
    const builder: Record<string, jest.Mock> = {};
    // Make the builder itself thenable so `await builder` works.
    // Assign .then directly so Jest's await can resolve it.
    (builder as unknown as PromiseLike<unknown>).then = (
      onFulfilled?: ((value: unknown) => unknown) | null,
    ) => Promise.resolve(resolveValue).then(onFulfilled);

    const chainFn = jest.fn().mockReturnValue(builder);

    builder.select = chainFn;
    builder.from = chainFn;
    builder.not = jest.fn().mockImplementation((...a) => {
      notSpy(...a);
      return builder;
    });
    builder.gte = jest.fn().mockImplementation((...a) => {
      gteSpy(...a);
      return builder;
    });
    builder.order = jest.fn().mockImplementation((...a) => {
      orderSpy(...a);
      return builder;
    });
    builder.limit = jest.fn().mockImplementation((...a) => {
      limitSpy(...a);
      return builder;
    });
    builder.eq = jest.fn().mockImplementation((...a) => {
      eqSpy(...a);
      return builder;
    });
    builder.in = jest.fn().mockImplementation((...a) => {
      inSpy(...a);
      return builder;
    });
    builder.or = jest.fn().mockImplementation((...a) => {
      orSpy(...a);
      return builder;
    });

    return builder;
  }

  // crosswalkBuilder is reused for geography_crosswalk table (select/eq/not chain)
  const crosswalkBuilder = makeBuilder({ data: crosswalkRows, error: null });

  const fromSpy = jest.fn().mockImplementation((table: string) => {
    if (table === 'geography_crosswalk') return crosswalkBuilder;
    // Source table: return next queued resolve
    const val = resolveQueue[queueIdx % resolveQueue.length];
    queueIdx++;
    return makeBuilder(val);
  });

  const supabase = {
    getClient: jest.fn().mockReturnValue({ from: fromSpy }),
  } as unknown as SupabaseService;

  const metricResolution = {} as unknown as MetricResolutionService;
  const service = new RankingResolverService(metricResolution, supabase);

  return {
    service,
    fromSpy,
    inSpy,
    gteSpy,
    orderSpy,
    notSpy,
    eqSpy,
    orSpy,
    limitSpy,
  };
}

// Base happy-path input
const nationalMetroInput: ResolveRankingInput = {
  format: 'top_10_ranking',
  metric_id: 'home_value',
  geo_level: 'metro',
  scope_type: 'national',
  scope_id: null,
};

// ---------------------------------------------------------------------------
// B1: Happy-path — top_10_ranking, national metros, 10 valid rows
// ---------------------------------------------------------------------------

describe('RankingResolverService.resolve — B1 happy path', () => {
  it('returns 10 ranked entries with correct shape', async () => {
    const { service } = buildHarness({ supabaseRows: makeMetroRows(10) });
    const result = await service.resolve(nationalMetroInput);

    expect(result.insufficient_data).toBe(false);
    expect(result.rankings).toHaveLength(10);
    expect(result.direction).toBe('top');
    expect(result.geo_level).toBe('metro');
    expect(result.metric.id).toBe('home_value');
    expect(result.metric.format).toBe('currency');
  });

  it('assigns sequential rank numbers starting at 1', async () => {
    const { service } = buildHarness({ supabaseRows: makeMetroRows(10) });
    const result = await service.resolve(nationalMetroInput);

    expect(result.rankings[0].rank).toBe(1);
    expect(result.rankings[9].rank).toBe(10);
  });

  it('populates region_id, region_name, state from source row columns', async () => {
    const { service } = buildHarness({ supabaseRows: makeMetroRows(10) });
    const result = await service.resolve(nationalMetroInput);
    const first = result.rankings[0];

    expect(first.region_id).toBe('10000');
    expect(first.region_name).toBe('Metro 0');
    expect(first.state).toBe('CA');
  });

  it('formats value_formatted as currency string', async () => {
    const { service } = buildHarness({ supabaseRows: makeMetroRows(10) });
    const result = await service.resolve(nationalMetroInput);

    expect(result.rankings[0].value_formatted).toMatch(/^\$/);
  });

  it('sets scope label to National when scope_id is null', async () => {
    const { service } = buildHarness({});
    const result = await service.resolve(nationalMetroInput);
    expect(result.scope.label).toBe('National');
  });
});

// ---------------------------------------------------------------------------
// B2: Scope filtering — national / state / metro
// ---------------------------------------------------------------------------

describe('RankingResolverService.resolve — B2 scope filtering', () => {
  it('national scope: does NOT query geography_crosswalk', async () => {
    const { service, fromSpy } = buildHarness({});
    await service.resolve(nationalMetroInput);
    const crosswalkCalls = fromSpy.mock.calls.filter(
      ([t]) => t === 'geography_crosswalk',
    );
    expect(crosswalkCalls).toHaveLength(0);
  });

  it('state scope: queries geography_crosswalk with state_abbrev eq filter', async () => {
    const crosswalkRows = [{ cbsa_code: '35620' }, { cbsa_code: '12060' }];
    const { service, fromSpy, eqSpy } = buildHarness({ crosswalkRows });

    await service.resolve({
      ...nationalMetroInput,
      scope_type: 'state',
      scope_id: 'CA',
    });

    expect(fromSpy).toHaveBeenCalledWith('geography_crosswalk');
    expect(eqSpy).toHaveBeenCalledWith('state_abbrev', 'CA');
  });

  it('metro scope: queries geography_crosswalk with cbsa_code eq filter', async () => {
    const crosswalkRows = [{ zip_code: '90210' }];
    const { service, fromSpy, eqSpy } = buildHarness({ crosswalkRows });

    await service.resolve({
      ...nationalMetroInput,
      scope_type: 'metro',
      scope_id: '31080',
    });

    expect(fromSpy).toHaveBeenCalledWith('geography_crosswalk');
    expect(eqSpy).toHaveBeenCalledWith('cbsa_code', '31080');
  });
});

// ---------------------------------------------------------------------------
// B3: Staleness filter + excluded_count
// ---------------------------------------------------------------------------

describe('RankingResolverService.resolve — B3 staleness + excluded_count', () => {
  it('applies .gte(dateColumn, cutoffDate) with date ~60 days ago for home_value', async () => {
    const { service, gteSpy } = buildHarness({});
    await service.resolve(nationalMetroInput);

    expect(gteSpy).toHaveBeenCalledWith('period_date', expect.any(String));
    const cutoff = gteSpy.mock.calls[0][1] as string;
    const cutoffMs = new Date(cutoff).getTime();
    const expectedMs = Date.now() - 60 * 24 * 60 * 60 * 1000;
    // Within 1 day tolerance
    expect(Math.abs(cutoffMs - expectedMs)).toBeLessThan(24 * 60 * 60 * 1000);
  });

  it('exposes excluded_count from the count query result', async () => {
    const { service } = buildHarness({ excludedCount: 7 });
    const result = await service.resolve(nationalMetroInput);
    expect(result.excluded_count).toBe(7);
  });
});
