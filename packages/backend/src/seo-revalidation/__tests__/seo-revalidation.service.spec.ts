import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SeoRevalidationService } from '../seo-revalidation.service';
import { SUPABASE_CLIENT } from '../../supabase/supabase.service';

// ---------------------------------------------------------------------------
// Helpers — build a chainable Supabase query-builder mock
// ---------------------------------------------------------------------------

function makeQueryBuilder(resolvedValue: unknown) {
  const builder: Record<string, jest.Mock> = {};
  const chain = () => builder;
  builder.select = jest.fn(chain);
  builder.eq = jest.fn(chain);
  builder.order = jest.fn(chain);
  builder.limit = jest.fn(chain);
  builder.maybeSingle = jest.fn().mockResolvedValue(resolvedValue);
  builder.upsert = jest.fn().mockResolvedValue({ error: null });
  return builder;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SeoRevalidationService', () => {
  let service: SeoRevalidationService;
  let supabaseMock: { from: jest.Mock };
  let configMock: { get: jest.Mock };

  beforeEach(async () => {
    supabaseMock = { from: jest.fn() };
    configMock = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeoRevalidationService,
        { provide: SUPABASE_CLIENT, useValue: supabaseMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get<SeoRevalidationService>(SeoRevalidationService);

    // Silence logger output during tests
    jest.spyOn(service['logger'], 'log').mockImplementation(() => undefined);
    jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);
    jest.spyOn(service['logger'], 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // (a) New score date → fetch called + state upserted
  // -------------------------------------------------------------------------
  describe('when a new score date is available', () => {
    let upsertMock: jest.Mock;

    beforeEach(async () => {
      // propertyiq_scores query → latest date
      const scoresBuilder = makeQueryBuilder({
        data: { score_date: '2026-05-01' },
        error: null,
      });
      // seo_revalidation_state query → different (older) date
      const stateBuilder = makeQueryBuilder({
        data: { last_score_date: '2026-04-01' },
        error: null,
      });
      upsertMock = jest.fn().mockResolvedValue({ error: null });
      stateBuilder.upsert = upsertMock;

      supabaseMock.from.mockImplementation((table: string) => {
        if (table === 'propertyiq_scores') return scoresBuilder;
        if (table === 'seo_revalidation_state') return stateBuilder;
        throw new Error(`Unexpected table: ${table}`);
      });

      configMock.get.mockImplementation((key: string) => {
        if (key === 'FRONTEND_URL') return 'https://propertyiq.app';
        if (key === 'REVALIDATE_SECRET') return 'test-secret';
        return undefined;
      });

      global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200 });

      await service.checkAndRevalidate();
    });

    it('POSTs to /api/revalidate-markets with the secret header', () => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [
        string,
        RequestInit,
      ];
      expect(url).toBe('https://propertyiq.app/api/revalidate-markets');
      expect(
        (init.headers as Record<string, string>)['x-revalidate-secret'],
      ).toBe('test-secret');
    });

    it('upserts seo_revalidation_state with the new score_date', () => {
      expect(upsertMock).toHaveBeenCalledTimes(1);
      const [payload] = upsertMock.mock.calls[0] as [Record<string, unknown>];
      expect(payload).toMatchObject({ id: 1, last_score_date: '2026-05-01' });
    });
  });

  // -------------------------------------------------------------------------
  // (b) Same date → fetch NOT called
  // -------------------------------------------------------------------------
  describe('when the score date has not changed', () => {
    beforeEach(async () => {
      const scoresBuilder = makeQueryBuilder({
        data: { score_date: '2026-05-01' },
        error: null,
      });
      const stateBuilder = makeQueryBuilder({
        data: { last_score_date: '2026-05-01' },
        error: null,
      });

      supabaseMock.from.mockImplementation((table: string) => {
        if (table === 'propertyiq_scores') return scoresBuilder;
        if (table === 'seo_revalidation_state') return stateBuilder;
        throw new Error(`Unexpected table: ${table}`);
      });

      global.fetch = jest.fn();

      await service.checkAndRevalidate();
    });

    it('does not call fetch', () => {
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // (c) Missing FRONTEND_URL → fetch NOT called, no throw
  // -------------------------------------------------------------------------
  describe('when FRONTEND_URL is missing', () => {
    beforeEach(async () => {
      const scoresBuilder = makeQueryBuilder({
        data: { score_date: '2026-05-01' },
        error: null,
      });
      const stateBuilder = makeQueryBuilder({
        data: { last_score_date: '2026-04-01' },
        error: null,
      });

      supabaseMock.from.mockImplementation((table: string) => {
        if (table === 'propertyiq_scores') return scoresBuilder;
        if (table === 'seo_revalidation_state') return stateBuilder;
        throw new Error(`Unexpected table: ${table}`);
      });

      configMock.get.mockImplementation((key: string) => {
        if (key === 'FRONTEND_URL') return undefined; // missing
        if (key === 'REVALIDATE_SECRET') return 'test-secret';
        return undefined;
      });

      global.fetch = jest.fn();

      await service.checkAndRevalidate();
    });

    it('does not call fetch', () => {
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('does not throw', () => {
      // test body completing without error is the assertion
    });
  });

  // -------------------------------------------------------------------------
  // (c-2) Missing REVALIDATE_SECRET → fetch NOT called, no throw
  // -------------------------------------------------------------------------
  describe('when REVALIDATE_SECRET is missing', () => {
    beforeEach(async () => {
      const scoresBuilder = makeQueryBuilder({
        data: { score_date: '2026-05-01' },
        error: null,
      });
      const stateBuilder = makeQueryBuilder({
        data: { last_score_date: '2026-04-01' },
        error: null,
      });

      supabaseMock.from.mockImplementation((table: string) => {
        if (table === 'propertyiq_scores') return scoresBuilder;
        if (table === 'seo_revalidation_state') return stateBuilder;
        throw new Error(`Unexpected table: ${table}`);
      });

      configMock.get.mockImplementation((key: string) => {
        if (key === 'FRONTEND_URL') return 'https://propertyiq.app';
        if (key === 'REVALIDATE_SECRET') return undefined; // missing
        return undefined;
      });

      global.fetch = jest.fn();

      await service.checkAndRevalidate();
    });

    it('does not call fetch', () => {
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('does not throw', () => {
      // test body completing without error is the assertion
    });
  });
});
