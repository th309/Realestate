/**
 * VisitorJourneyService — the contract between two SQL RPCs and the Visitors tab.
 *
 * The aggregation lives in Postgres, so what is worth pinning here is everything
 * the service adds on top, each of which is a way the tab could quietly lie:
 *
 *  - PostgREST returns `bigint` and `numeric` as strings. Passed through
 *    untouched, `sessions` sorts lexically ("9" > "10") and `totalSeconds`
 *    concatenates instead of adding.
 *  - The RPCs order-then-cap. A full page means the journey continues past the
 *    last row, so `truncated` has to be reported or a cut-off relationship
 *    renders as a completed one.
 *  - An unbounded `limit` from the query string must be clamped, and a garbage
 *    one must fall to the default rather than to the maximum.
 *  - The traffic segment must reach the RPC. Omitted, the list silently mixes
 *    crawlers into a view labelled as people.
 *  - A failed query must throw. On a drill-down, "this visitor did nothing" and
 *    "the query failed" are opposite conclusions that must not render alike.
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  VisitorJourneyService,
  VISITOR_LIST_DEFAULT_LIMIT,
  VISITOR_LIST_MAX_LIMIT,
  VISITOR_TIMELINE_DEFAULT_LIMIT,
  VISITOR_TIMELINE_MAX_LIMIT,
} from '../visitor-journey.service';
import { SupabaseService } from '../../supabase/supabase.service';

/** A list row exactly as PostgREST hands it back — bigints/numerics quoted. */
const LIST_ROW = {
  visitor_id: 'ba057c79-c80b-4e85-864e-ef28e5daa9e9',
  user_id: '110495c9-d777-4431-aa24-a2719288ce81',
  user_tier: 'pro',
  first_seen: '2026-07-03T01:47:18.099Z',
  last_seen: '2026-07-30T00:58:34.063Z',
  sessions: '39',
  pageviews: '1218',
  interactions: '899',
  total_seconds: '53785',
  entry_type: 'direct',
  source: 'direct',
  landing_page: '/reports',
  converted: true,
};

const SESSION_START_ROW = {
  occurred_at: '2026-06-18T16:27:00.000Z',
  session_id: '0ed56d2d-db9e-4a30-b5e1-524e3ac703f0',
  kind: 'session_start',
  event_category: null,
  event_action: null,
  page_path: '/map',
  previous_page_path: null,
  label: 'direct',
  properties: { device_type: 'desktop', browser: 'Chrome' },
};

const EVENT_ROW = {
  occurred_at: '2026-06-18T16:55:34.183Z',
  session_id: '0ed56d2d-db9e-4a30-b5e1-524e3ac703f0',
  kind: 'event',
  event_category: 'feature',
  event_action: 'map_filter',
  page_path: '/map',
  previous_page_path: '/screener',
  label: null,
  properties: null,
};

const mockClient = { rpc: jest.fn() };
const mockSupabase = { getClient: jest.fn(() => mockClient) };

/**
 * Last arguments the RPC was called with, for the named function.
 *
 * The recorded calls are typed at the fixture rather than left as `any`, so a
 * typo in an argument name is a compile error here instead of a silent
 * `undefined` that makes an assertion vacuously pass.
 */
type RecordedRpcCall = [string, Record<string, unknown>];

function rpcArgs(name: string): Record<string, unknown> {
  const calls = mockClient.rpc.mock.calls as RecordedRpcCall[];
  return calls.filter((call) => call[0] === name).pop()?.[1] ?? {};
}

describe('VisitorJourneyService', () => {
  let service: VisitorJourneyService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockClient.rpc.mockResolvedValue({ data: [], error: null });

    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        VisitorJourneyService,
        { provide: SupabaseService, useValue: mockSupabase },
      ],
    }).compile();
    service = mod.get(VisitorJourneyService);
  });

  describe('listVisitors', () => {
    it('coerces the quoted bigints and numerics PostgREST returns into numbers', async () => {
      mockClient.rpc.mockResolvedValue({ data: [LIST_ROW], error: null });

      const { visitors } = await service.listVisitors(30, {});

      expect(visitors[0].sessions).toBe(39);
      expect(visitors[0].pageviews).toBe(1218);
      expect(visitors[0].interactions).toBe(899);
      expect(visitors[0].totalSeconds).toBe(53785);
      // Not "39" — a string here sorts lexically and breaks every comparison.
      expect(typeof visitors[0].sessions).toBe('number');
      expect(typeof visitors[0].totalSeconds).toBe('number');
    });

    it('maps acquisition columns onto camelCase without inventing fields', async () => {
      mockClient.rpc.mockResolvedValue({ data: [LIST_ROW], error: null });

      const { visitors } = await service.listVisitors(30, {});

      expect(visitors[0]).toEqual({
        visitorId: 'ba057c79-c80b-4e85-864e-ef28e5daa9e9',
        userId: '110495c9-d777-4431-aa24-a2719288ce81',
        userTier: 'pro',
        firstSeen: '2026-07-03T01:47:18.099Z',
        lastSeen: '2026-07-30T00:58:34.063Z',
        sessions: 39,
        pageviews: 1218,
        interactions: 899,
        totalSeconds: 53785,
        entryType: 'direct',
        source: 'direct',
        landingPage: '/reports',
        converted: true,
      });
    });

    it('keeps an anonymous visitor null rather than fabricating an identity', async () => {
      mockClient.rpc.mockResolvedValue({
        data: [
          {
            ...LIST_ROW,
            user_id: null,
            user_tier: null,
            source: null,
            landing_page: null,
            converted: false,
          },
        ],
        error: null,
      });

      const { visitors } = await service.listVisitors(30, {});

      expect(visitors[0].userId).toBeNull();
      expect(visitors[0].userTier).toBeNull();
      expect(visitors[0].source).toBeNull();
      expect(visitors[0].landingPage).toBeNull();
      expect(visitors[0].converted).toBe(false);
    });

    it('sends the traffic segment through, so the list cannot mix in crawlers', async () => {
      await service.listVisitors(30, { traffic: 'bot' });
      expect(rpcArgs('analytics_visitor_list').p_traffic).toBe('bot');
    });

    it('defaults an absent segment to human rather than leaving it to the RPC', async () => {
      await service.listVisitors(30, {});
      expect(rpcArgs('analytics_visitor_list').p_traffic).toBe('human');
    });

    it('passes the converted-only flag when asked, and false when not', async () => {
      await service.listVisitors(30, {}, { onlyConverted: true });
      expect(rpcArgs('analytics_visitor_list').p_only_converted).toBe(true);

      await service.listVisitors(30, {});
      expect(rpcArgs('analytics_visitor_list').p_only_converted).toBe(false);
    });

    it('derives the window from the day count', async () => {
      const before = Date.now();
      await service.listVisitors(7, {});
      const start = new Date(
        rpcArgs('analytics_visitor_list').p_start as string,
      ).getTime();

      expect(before - start).toBeGreaterThanOrEqual(7 * 86_400_000 - 5_000);
      expect(before - start).toBeLessThanOrEqual(7 * 86_400_000 + 5_000);
      expect(rpcArgs('analytics_visitor_list').p_end).toBeNull();
    });

    it('prefers an explicit date range over the rolling day count', async () => {
      await service.listVisitors(30, {
        startDate: '2026-01-01',
        endDate: '2026-02-01',
      });

      const args = rpcArgs('analytics_visitor_list');
      expect(args.p_start).toBe(new Date('2026-01-01').toISOString());
      expect(args.p_end).toBe(new Date('2026-02-01').toISOString());
    });

    it('clamps an oversized limit instead of forwarding it', async () => {
      await service.listVisitors(30, {}, { limit: 100_000 });
      expect(rpcArgs('analytics_visitor_list').p_limit).toBe(
        VISITOR_LIST_MAX_LIMIT,
      );
    });

    it('falls back to the default limit on a garbage value, never to the maximum', async () => {
      await service.listVisitors(30, {}, { limit: NaN });
      expect(rpcArgs('analytics_visitor_list').p_limit).toBe(
        VISITOR_LIST_DEFAULT_LIMIT,
      );

      await service.listVisitors(30, {}, { limit: -5 });
      expect(rpcArgs('analytics_visitor_list').p_limit).toBe(
        VISITOR_LIST_DEFAULT_LIMIT,
      );
    });

    it('reports truncation when the cap is hit, so the UI can say there are more', async () => {
      mockClient.rpc.mockResolvedValue({
        data: [LIST_ROW, LIST_ROW],
        error: null,
      });

      const result = await service.listVisitors(30, {}, { limit: 2 });

      expect(result.truncated).toBe(true);
      expect(result.limit).toBe(2);
    });

    it('does not claim truncation on a short page', async () => {
      mockClient.rpc.mockResolvedValue({ data: [LIST_ROW], error: null });
      const result = await service.listVisitors(30, {}, { limit: 50 });
      expect(result.truncated).toBe(false);
    });

    it('returns an empty list, not an error, when nobody matches', async () => {
      mockClient.rpc.mockResolvedValue({ data: [], error: null });
      const result = await service.listVisitors(30, {});
      expect(result.visitors).toEqual([]);
      expect(result.truncated).toBe(false);
    });

    it('throws when the query fails, rather than reporting zero visitors', async () => {
      mockClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'permission denied' },
      });

      await expect(service.listVisitors(30, {})).rejects.toThrow(
        /permission denied/,
      );
    });
  });

  describe('getTimeline', () => {
    it('preserves chronological order and distinguishes the two row kinds', async () => {
      mockClient.rpc.mockResolvedValue({
        data: [SESSION_START_ROW, EVENT_ROW],
        error: null,
      });

      const { entries } = await service.getTimeline('visitor-1');

      expect(entries.map((e) => e.kind)).toEqual(['session_start', 'event']);
      expect(entries[0].pagePath).toBe('/map');
      // A session_start carries entry type in `label` and no category/action.
      expect(entries[0].label).toBe('direct');
      expect(entries[0].eventCategory).toBeNull();
      expect(entries[1].eventCategory).toBe('feature');
      expect(entries[1].eventAction).toBe('map_filter');
      expect(entries[1].previousPagePath).toBe('/screener');
    });

    it('keeps the session_start properties blob for the session header', async () => {
      mockClient.rpc.mockResolvedValue({
        data: [SESSION_START_ROW],
        error: null,
      });

      const { entries } = await service.getTimeline('visitor-1');

      expect(entries[0].properties).toEqual({
        device_type: 'desktop',
        browser: 'Chrome',
      });
    });

    it('normalises an unexpected kind to event rather than trusting it', async () => {
      mockClient.rpc.mockResolvedValue({
        data: [{ ...EVENT_ROW, kind: 'something_else' }],
        error: null,
      });

      const { entries } = await service.getTimeline('visitor-1');
      expect(entries[0].kind).toBe('event');
    });

    it('counts the distinct sessions the entries span', async () => {
      mockClient.rpc.mockResolvedValue({
        data: [
          SESSION_START_ROW,
          EVENT_ROW,
          { ...EVENT_ROW, session_id: 'other-session' },
        ],
        error: null,
      });

      const { sessionCount } = await service.getTimeline('visitor-1');
      expect(sessionCount).toBe(2);
    });

    it('passes the visitor id and default limit to the RPC', async () => {
      await service.getTimeline('visitor-1');

      expect(rpcArgs('analytics_visitor_timeline')).toEqual({
        p_visitor_id: 'visitor-1',
        p_limit: VISITOR_TIMELINE_DEFAULT_LIMIT,
      });
    });

    it('clamps an oversized timeline limit', async () => {
      await service.getTimeline('visitor-1', 999_999);
      expect(rpcArgs('analytics_visitor_timeline').p_limit).toBe(
        VISITOR_TIMELINE_MAX_LIMIT,
      );
    });

    it('flags truncation when the cap is reached, since the journey continues', async () => {
      mockClient.rpc.mockResolvedValue({
        data: [SESSION_START_ROW, EVENT_ROW],
        error: null,
      });

      const result = await service.getTimeline('visitor-1', 2);

      expect(result.truncated).toBe(true);
      expect(result.limit).toBe(2);
      expect(result.visitorId).toBe('visitor-1');
    });

    it('returns an empty timeline for a visitor with no recorded activity', async () => {
      mockClient.rpc.mockResolvedValue({ data: [], error: null });

      const result = await service.getTimeline('ghost');

      expect(result.entries).toEqual([]);
      expect(result.sessionCount).toBe(0);
      expect(result.truncated).toBe(false);
    });

    it('throws when the timeline query fails', async () => {
      mockClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'statement timeout' },
      });

      await expect(service.getTimeline('visitor-1')).rejects.toThrow(
        /statement timeout/,
      );
    });
  });
});
