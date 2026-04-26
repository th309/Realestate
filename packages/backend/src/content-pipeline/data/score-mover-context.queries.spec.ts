// packages/backend/src/content-pipeline/data/score-mover-context.queries.spec.ts
import {
  fetchTopMovers,
  fetchScoreMoverContext,
} from './score-mover-context.queries';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The Supabase client interface is wide; we only need a tiny subset.
 * This stub returns a sequenced list of canned responses, one per call.
 */
function stubClient(responses: unknown[]): SupabaseClient {
  const queue = [...responses];
  const builder: any = {
    from: () => builder,
    select: () => builder,
    eq: () => builder,
    in: () => builder,
    not: () => builder,
    lte: () => builder,
    gte: () => builder,
    order: () => builder,
    limit: () => builder,
    range: () => Promise.resolve(queue.shift() ?? { data: [], error: null }),
    then(resolve: (v: unknown) => unknown) {
      return Promise.resolve(queue.shift() ?? { data: [], error: null }).then(
        resolve,
      );
    },
  };
  return builder as SupabaseClient;
}

describe('fetchTopMovers', () => {
  it('returns dual lists ranked by signed delta', async () => {
    const client = stubClient([
      { data: [{ score_date: '2026-04-25' }], error: null },
      { data: [{ score_date: '2026-01-25' }], error: null },
      {
        data: [
          { location_id: 'a', location_name: 'Tampa, FL', score: 78 },
          { location_id: 'b', location_name: 'Boise, ID', score: 42 },
          { location_id: 'c', location_name: 'Charlotte, NC', score: 81 },
          { location_id: 'd', location_name: 'Tiny, XX', score: 95 },
        ],
        error: null,
      },
      { data: [], error: null },
      {
        data: [
          { location_id: 'a', location_name: 'Tampa, FL', score: 66 },
          { location_id: 'b', location_name: 'Boise, ID', score: 58 },
          { location_id: 'c', location_name: 'Charlotte, NC', score: 71 },
          { location_id: 'd', location_name: 'Tiny, XX', score: 50 },
        ],
        error: null,
      },
      { data: [], error: null },
      {
        data: [
          { location_id: 'a', population: 1_600_000 },
          { location_id: 'b', population: 320_000 },
          { location_id: 'c', population: 1_100_000 },
          { location_id: 'd', population: 500 },
        ],
        error: null,
      },
    ]);

    const out = await fetchTopMovers(client, 'metro', 90, 25);
    expect(out.window).toEqual({
      latestDate: '2026-04-25',
      priorDate: '2026-01-25',
      windowDays: 90,
      requestedGeo: 'metro',
    });
    expect(out.qualifiedCount).toBe(3);
    expect(out.up.map((m) => m.id)).toEqual(['a', 'c']);
    expect(out.up[0].delta).toBe(12);
    expect(out.up[1].delta).toBe(10);
    expect(out.down.map((m) => m.id)).toEqual(['b']);
    expect(out.down[0].delta).toBe(-16);
  });

  it('returns null window when no prior score_date found', async () => {
    const client = stubClient([
      { data: [{ score_date: '2026-04-25' }], error: null },
      { data: [], error: null },
    ]);
    const out = await fetchTopMovers(client, 'zip', 30, 25);
    expect(out.window).toBeNull();
    expect(out.qualifiedCount).toBe(0);
    expect(out.up).toEqual([]);
    expect(out.down).toEqual([]);
  });

  it('breaks ties by population desc, then canonical_name asc', async () => {
    const client = stubClient([
      { data: [{ score_date: '2026-04-25' }], error: null },
      { data: [{ score_date: '2026-01-25' }], error: null },
      {
        data: [
          { location_id: 'a', location_name: 'Alpha, XX', score: 70 },
          { location_id: 'b', location_name: 'Bravo, XX', score: 70 },
          { location_id: 'c', location_name: 'Cervo, XX', score: 70 },
        ],
        error: null,
      },
      { data: [], error: null },
      {
        data: [
          { location_id: 'a', location_name: 'Alpha, XX', score: 60 },
          { location_id: 'b', location_name: 'Bravo, XX', score: 60 },
          { location_id: 'c', location_name: 'Cervo, XX', score: 60 },
        ],
        error: null,
      },
      { data: [], error: null },
      {
        data: [
          { location_id: 'a', population: 100_000 },
          { location_id: 'b', population: 1_000_000 },
          { location_id: 'c', population: 100_000 },
        ],
        error: null,
      },
    ]);
    const out = await fetchTopMovers(client, 'metro', 90, 25);
    expect(out.up.map((m) => m.id)).toEqual(['b', 'a', 'c']);
  });
});

describe('fetchScoreMoverContext', () => {
  it('returns null when no prior score within window', async () => {
    const client = stubClient([
      { data: [{ score_date: '2026-04-25', score: 78 }], error: null },
      { data: [], error: null },
    ]);
    const out = await fetchScoreMoverContext(client, 'cbsa-tampa', 'metro', 30);
    expect(out).toBeNull();
  });

  it('returns delta + windowLabel when prior exists', async () => {
    const client = stubClient([
      { data: [{ score_date: '2026-04-25', score: 78 }], error: null },
      { data: [{ score_date: '2026-01-25', score: 66 }], error: null },
    ]);
    const out = await fetchScoreMoverContext(client, 'cbsa-tampa', 'metro', 90);
    expect(out).toEqual({
      current: { score: 78, scoreDate: '2026-04-25' },
      prior: { score: 66, scoreDate: '2026-01-25' },
      delta: 12,
      windowDays: 90,
      windowLabel: 'this quarter',
      windowCaption: 'Last 90 days',
    });
  });
});
