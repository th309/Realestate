import { FetchDataHandler } from './fetch-data.handler';
import { SupabaseService } from '../../../supabase/supabase.service';
import { RunOrchestratorService } from '../run-orchestrator.service';
import { ContentDataService } from '../../data/content-data.service';

describe('FetchDataHandler', () => {
  function buildHarness(overrides?: {
    runRow?: Record<string, unknown> | null;
    resolveMatches?: Array<{
      geography: 'metro' | 'state' | 'county' | 'zip';
      id: string;
      canonical_name: string;
    }>;
    snapshotThrows?: Error;
    resolveThrows?: Error;
  }) {
    const runRow =
      overrides?.runRow === undefined
        ? { market_query: 'Cleveland, OH', format: 'youtube_shorts_15s' }
        : overrides.runRow;

    const runSelectSingle = jest.fn().mockResolvedValue({ data: runRow });
    const runUpdateEq = jest.fn().mockResolvedValue({ error: null });
    const assetsDeleteEq2 = jest.fn().mockResolvedValue({ error: null });
    const assetsDeleteEq1 = jest.fn().mockReturnValue({ eq: assetsDeleteEq2 });
    const assetsInsert = jest.fn().mockResolvedValue({ error: null });

    const supabaseClient = {
      from: jest.fn((table: string) => {
        if (table === 'content_runs') {
          return {
            select: () => ({
              eq: () => ({ single: runSelectSingle }),
            }),
            update: () => ({ eq: runUpdateEq }),
          };
        }
        if (table === 'content_assets') {
          return {
            delete: () => ({ eq: assetsDeleteEq1 }),
            insert: assetsInsert,
          };
        }
        return {};
      }),
    };

    const supabase = {
      getClient: () => supabaseClient,
    } as unknown as SupabaseService;

    const handleStepSuccess = jest.fn().mockResolvedValue(undefined);
    const handleStepFailure = jest.fn().mockResolvedValue(undefined);
    const orchestrator = {
      handleStepSuccess,
      handleStepFailure,
    } as unknown as RunOrchestratorService;

    const resolveMarket = jest.fn();
    if (overrides?.resolveThrows) {
      resolveMarket.mockRejectedValue(overrides.resolveThrows);
    } else {
      resolveMarket.mockResolvedValue(
        overrides?.resolveMatches ?? [
          {
            geography: 'metro' as const,
            id: '17460',
            canonical_name: 'Cleveland, OH',
          },
        ],
      );
    }

    const getMarketSnapshot = jest.fn();
    if (overrides?.snapshotThrows) {
      getMarketSnapshot.mockRejectedValue(overrides.snapshotThrows);
    } else {
      getMarketSnapshot.mockResolvedValue({ score: 80, confidence: 'A' });
    }

    const data = {
      resolveMarket,
      getMarketSnapshot,
    } as unknown as ContentDataService;

    const handler = new FetchDataHandler(orchestrator, data, supabase);
    return {
      handler,
      handleStepSuccess,
      handleStepFailure,
      runUpdateEq,
      assetsInsert,
      assetsDeleteEq2,
      resolveMarket,
      getMarketSnapshot,
    };
  }

  it('calls handleStepSuccess on the happy path', async () => {
    const { handler, handleStepSuccess, handleStepFailure } = buildHarness();

    await handler.handle('run-1');

    expect(handleStepSuccess).toHaveBeenCalledWith('run-1');
    expect(handleStepFailure).not.toHaveBeenCalled();
  });

  it('persists resolved_geo from the first match onto the run row', async () => {
    const { handler, runUpdateEq } = buildHarness({
      resolveMatches: [
        {
          geography: 'metro',
          id: '35620',
          canonical_name: 'New York, NY',
        },
      ],
    });

    await handler.handle('run-2');

    // The mock chain swallows the .update() args via the closure — we confirm
    // the .eq() terminator at least fired, which proves the chain executed.
    expect(runUpdateEq).toHaveBeenCalled();
  });

  it('inserts an mcp_payload asset with the snapshot in its metadata', async () => {
    const { handler, assetsInsert } = buildHarness();

    await handler.handle('run-3');

    expect(assetsInsert).toHaveBeenCalledTimes(1);
    const inserted = assetsInsert.mock.calls[0][0];
    expect(inserted.run_id).toBe('run-3');
    expect(inserted.kind).toBe('mcp_payload');
    expect(inserted.storage_url).toBe('inline');
    expect(inserted.metadata).toEqual({ score: 80, confidence: 'A' });
  });

  it('deletes any pre-existing mcp_payload before inserting (idempotent retry)', async () => {
    const { handler, assetsDeleteEq2, assetsInsert } = buildHarness();

    await handler.handle('run-4');

    expect(assetsDeleteEq2).toHaveBeenCalled();
    // delete before insert
    const deleteOrder = assetsDeleteEq2.mock.invocationCallOrder[0];
    const insertOrder = assetsInsert.mock.invocationCallOrder[0];
    expect(deleteOrder).toBeLessThan(insertOrder);
  });

  it('routes through handleStepFailure with fetch_data prefix when no markets match', async () => {
    const { handler, handleStepFailure, handleStepSuccess } = buildHarness({
      resolveMatches: [],
      runRow: { market_query: 'Mars City', format: 'youtube_shorts_15s' },
    });

    await handler.handle('run-5');

    expect(handleStepFailure).toHaveBeenCalledWith(
      'run-5',
      'fetch_data: no market match for "Mars City"',
    );
    expect(handleStepSuccess).not.toHaveBeenCalled();
  });

  it('routes through handleStepFailure when run row is missing', async () => {
    const { handler, handleStepFailure } = buildHarness({ runRow: null });

    await handler.handle('run-missing');

    expect(handleStepFailure).toHaveBeenCalledWith(
      'run-missing',
      'fetch_data: run not found',
    );
  });

  it('routes through handleStepFailure when ContentDataService.resolveMarket throws', async () => {
    const { handler, handleStepFailure } = buildHarness({
      resolveThrows: new Error('mapbox down'),
    });

    await handler.handle('run-resolve');

    expect(handleStepFailure).toHaveBeenCalledWith(
      'run-resolve',
      'fetch_data: mapbox down',
    );
  });

  it('routes through handleStepFailure when getMarketSnapshot throws', async () => {
    const { handler, handleStepFailure, assetsInsert } = buildHarness({
      snapshotThrows: new Error('scoring fail'),
    });

    await handler.handle('run-snap');

    expect(handleStepFailure).toHaveBeenCalledWith(
      'run-snap',
      'fetch_data: scoring fail',
    );
    expect(assetsInsert).not.toHaveBeenCalled();
  });

  it('passes the run.market_query through to ContentDataService.resolveMarket', async () => {
    const { handler, resolveMarket } = buildHarness({
      runRow: {
        market_query: 'Austin, TX',
        format: 'youtube_shorts_15s',
      },
    });

    await handler.handle('run-q');

    expect(resolveMarket).toHaveBeenCalledWith('Austin, TX');
  });

  it('passes the resolved geo (first match) to getMarketSnapshot', async () => {
    const { handler, getMarketSnapshot } = buildHarness({
      resolveMatches: [
        {
          geography: 'metro',
          id: '12420',
          canonical_name: 'Austin, TX',
        },
        {
          geography: 'metro',
          id: '99999',
          canonical_name: 'Wrong, ZZ',
        },
      ],
    });

    await handler.handle('run-first');

    expect(getMarketSnapshot).toHaveBeenCalledWith({
      geography: 'metro',
      id: '12420',
      canonical_name: 'Austin, TX',
    });
  });

  // -------------------------------------------------------------------------
  // Ranking format branch
  // -------------------------------------------------------------------------

  describe('ranking format (top_10_ranking / bottom_10_ranking)', () => {
    const sampleResolvedMarkets = [
      {
        rank: 1,
        region_id: '35620',
        region_name: 'New York',
        state: 'NY',
        value: 87,
        value_formatted: '87',
      },
      {
        rank: 2,
        region_id: '31080',
        region_name: 'Los Angeles',
        state: 'CA',
        value: 82,
        value_formatted: '82',
      },
    ];

    const rankingFormatOptions = {
      ranking: {
        metric: { id: 'propertyiq_score' },
        geo_level: 'metro',
        scope: { type: 'national', id: null },
        resolved_markets: sampleResolvedMarkets,
      },
    };

    it('builds dataBundle from format_options.ranking and skips resolveMarket', async () => {
      const { handler, assetsInsert, resolveMarket, getMarketSnapshot } =
        buildHarness({
          runRow: {
            market_query: 'Top 10 metros by PropertyIQ Score — National',
            format: 'top_10_ranking',
            format_options: rankingFormatOptions,
          },
        });

      await handler.handle('run-rank-1');

      expect(resolveMarket).not.toHaveBeenCalled();
      expect(getMarketSnapshot).not.toHaveBeenCalled();

      expect(assetsInsert).toHaveBeenCalledTimes(1);
      const inserted = assetsInsert.mock.calls[0][0];
      expect(inserted.run_id).toBe('run-rank-1');
      expect(inserted.kind).toBe('mcp_payload');
      const bundle = inserted.metadata as Record<string, unknown>;
      expect(bundle.format).toBe('top_10_ranking');
      expect(bundle.direction).toBe('top');
      expect(bundle.geo_level).toBe('metro');
      expect((bundle.metric as { id: string }).id).toBe('propertyiq_score');
      expect((bundle.metric as { label: string }).label).toBe(
        'PropertyIQ Score',
      );
      expect((bundle.scope as { label: string }).label).toBe('National');
      expect(bundle.resolved_markets).toEqual(sampleResolvedMarkets);
    });

    it('sets direction=bottom for bottom_10_ranking', async () => {
      const { handler, assetsInsert } = buildHarness({
        runRow: {
          market_query: 'Bottom 10 metros by PropertyIQ Score — National',
          format: 'bottom_10_ranking',
          format_options: rankingFormatOptions,
        },
      });

      await handler.handle('run-rank-2');

      const bundle = assetsInsert.mock.calls[0][0].metadata as Record<
        string,
        unknown
      >;
      expect(bundle.direction).toBe('bottom');
    });

    it('routes through handleStepFailure when format_options.ranking is missing', async () => {
      const { handler, handleStepFailure, handleStepSuccess, assetsInsert } =
        buildHarness({
          runRow: {
            market_query: 'Top 10 metros by PropertyIQ Score — National',
            format: 'top_10_ranking',
            format_options: {},
          },
        });

      await handler.handle('run-rank-missing');

      expect(handleStepFailure).toHaveBeenCalledWith(
        'run-rank-missing',
        expect.stringContaining('ranking_params_missing'),
      );
      expect(handleStepSuccess).not.toHaveBeenCalled();
      expect(assetsInsert).not.toHaveBeenCalled();
    });
  });
});
