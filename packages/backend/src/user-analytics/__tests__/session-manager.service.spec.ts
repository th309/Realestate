/**
 * SessionManagerService Unit Tests
 *
 * Focused on the insert-race handling, since that path silently discarded data
 * before and is otherwise hard to observe:
 * - A 23505 (unique violation) insert retries once and merges via the update
 *   path, rather than dropping the batch
 * - The retry is bounded and cannot recurse forever
 * - Acquisition fields are backfilled only where the existing row is null, so
 *   the insert winner's real attribution is never overwritten
 * - converted is a one-way ratchet
 */

import { Test, TestingModule } from '@nestjs/testing';
import { SessionManagerService } from '../session-manager.service';
import { SupabaseService } from '../../supabase/supabase.service';
import type { IngestableEvent } from '../user-analytics.types';

const UNIQUE_VIOLATION = '23505';

function pageviewEvent(
  overrides: Partial<IngestableEvent> = {},
): IngestableEvent {
  return {
    visitor_id: 'v1',
    session_id: 's1',
    event_category: 'pageview',
    event_action: 'view',
    page_path: '/blog/best-markets',
    properties: {
      entry_type: 'search',
      referrer_domain: 'www.google.com',
      utm_source: undefined,
    },
    ...overrides,
  } as IngestableEvent;
}

describe('SessionManagerService', () => {
  let service: SessionManagerService;
  let mockQueryBuilder: Record<string, jest.Mock>;
  let existingRow: Record<string, unknown> | null;
  let insertError: { code: string; message: string } | null;
  let updateError: { message: string } | null;
  let selectError: { message: string } | null;

  beforeEach(async () => {
    existingRow = null;
    insertError = null;
    updateError = null;
    selectError = null;

    mockQueryBuilder = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn(),
      maybeSingle: jest.fn(() =>
        Promise.resolve({ data: existingRow, error: selectError }),
      ),
      insert: jest.fn(() => Promise.resolve({ error: insertError })),
      update: jest.fn().mockReturnThis(),
    };

    // .eq() terminates the update chain (awaited directly) but continues the
    // select chain (.maybeSingle() follows), so it must be both thenable and
    // chainable. It resolves to the current `updateError` rather than a
    // hardcoded null, so the update failure branch is actually reachable.
    mockQueryBuilder.eq.mockImplementation(() => ({
      ...mockQueryBuilder,
      then: (resolve: (v: unknown) => void) =>
        Promise.resolve({ error: updateError }).then(resolve),
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionManagerService,
        {
          provide: SupabaseService,
          useValue: { getClient: jest.fn(() => mockQueryBuilder) },
        },
      ],
    }).compile();

    service = module.get<SessionManagerService>(SessionManagerService);
  });

  describe('upsertSession recovers from a concurrent insert', () => {
    it('retries through the update path instead of dropping the batch', async () => {
      // First pass: no row exists, so insert is attempted and loses the race.
      // Retry: the winner's row is now visible, so the update path runs.
      insertError = { code: UNIQUE_VIOLATION, message: 'duplicate key' };
      mockQueryBuilder.maybeSingle
        .mockResolvedValueOnce({ data: null })
        .mockResolvedValueOnce({
          data: { session_id: 's1', page_count: 1, feature_events_count: 0 },
        });

      await service.upsertSession('s1', [pageviewEvent()]);

      expect(mockQueryBuilder.insert).toHaveBeenCalledTimes(1);
      expect(mockQueryBuilder.update).toHaveBeenCalledTimes(1);
      // The losing batch's pageview is merged, not lost: 1 existing + 1 new.
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({ page_count: 2 }),
      );
    });

    it('does not retry more than once', async () => {
      // Insert keeps failing and the row never becomes visible. The isRetry
      // guard must stop this rather than recursing indefinitely.
      insertError = { code: UNIQUE_VIOLATION, message: 'duplicate key' };
      mockQueryBuilder.maybeSingle.mockResolvedValue({ data: null });

      await service.upsertSession('s1', [pageviewEvent()]);

      expect(mockQueryBuilder.insert).toHaveBeenCalledTimes(2);
      expect(mockQueryBuilder.update).not.toHaveBeenCalled();
    });

    it('does not retry on a non-conflict insert error', async () => {
      insertError = { code: '23502', message: 'not null violation' };
      mockQueryBuilder.maybeSingle.mockResolvedValue({ data: null });

      await service.upsertSession('s1', [pageviewEvent()]);

      expect(mockQueryBuilder.insert).toHaveBeenCalledTimes(1);
    });
  });

  describe('upsertSession backfills acquisition fields only when missing', () => {
    it('fills session-invariant acquisition fields when the row has none', async () => {
      existingRow = {
        session_id: 's1',
        page_count: 1,
        feature_events_count: 0,
        landing_page: null,
        entry_type: null,
        referrer_domain: null,
      };

      await service.upsertSession('s1', [pageviewEvent()]);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          entry_type: 'search',
          referrer_domain: 'www.google.com',
        }),
      );
    });

    it('never backfills landing_page, which is order-dependent', async () => {
      // landing_page comes from whichever pageview is in THIS batch, so
      // backfilling it could write a confidently wrong value when batches
      // arrive out of order. A null landing page is honest; the read side
      // already filters nulls out.
      existingRow = {
        session_id: 's1',
        page_count: 1,
        feature_events_count: 0,
        landing_page: null,
        entry_type: null,
      };

      await service.upsertSession('s1', [pageviewEvent()]);

      const payload = mockQueryBuilder.update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(payload).not.toHaveProperty('landing_page');
    });

    it('never overwrites attribution the insert winner already recorded', async () => {
      existingRow = {
        session_id: 's1',
        page_count: 1,
        feature_events_count: 0,
        entry_type: 'direct',
        referrer_domain: null,
      };

      await service.upsertSession('s1', [pageviewEvent()]);

      const payload = mockQueryBuilder.update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(payload).not.toHaveProperty('entry_type');
      // Still fills the one field that genuinely was null.
      expect(payload.referrer_domain).toBe('www.google.com');
    });
  });

  describe('upsertSession surfaces query failures', () => {
    it('logs and aborts when the initial select fails', async () => {
      const errorSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => undefined);
      selectError = { message: 'connection reset' };

      await service.upsertSession('s1', [pageviewEvent()]);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('connection reset'),
      );
      // Must not attempt a write on an unreliable read.
      expect(mockQueryBuilder.insert).not.toHaveBeenCalled();
      expect(mockQueryBuilder.update).not.toHaveBeenCalled();
    });

    it('logs when the update fails', async () => {
      const errorSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => undefined);
      existingRow = {
        session_id: 's1',
        page_count: 1,
        feature_events_count: 0,
      };
      updateError = { message: 'deadlock detected' };

      await service.upsertSession('s1', [pageviewEvent()]);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('deadlock detected'),
      );
    });
  });

  describe('upsertSession treats conversion as a one-way ratchet', () => {
    it('sets converted when the batch contains signup_complete', async () => {
      existingRow = {
        session_id: 's1',
        page_count: 1,
        feature_events_count: 0,
      };

      await service.upsertSession('s1', [
        pageviewEvent({
          event_category: 'conversion',
          event_action: 'signup_complete',
        }),
      ]);

      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          converted: true,
          conversion_type: 'signup_complete',
        }),
      );
    });

    it('does not clear converted on a later non-conversion batch', async () => {
      existingRow = {
        session_id: 's1',
        page_count: 1,
        feature_events_count: 0,
      };

      await service.upsertSession('s1', [pageviewEvent()]);

      const payload = mockQueryBuilder.update.mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(payload).not.toHaveProperty('converted');
    });
  });
});
