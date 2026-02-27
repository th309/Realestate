/**
 * IdentityStitchingService Unit Tests
 *
 * Tests visitor-to-user identity linking including:
 * - Querying earliest session for acquisition source
 * - Counting all sessions for the visitor
 * - Upserting visitor_identities record
 * - Backfilling user_id on sessions and events where null
 * - Handling missing session data gracefully
 */

import { Test, TestingModule } from '@nestjs/testing';
import { IdentityStitchingService } from '../identity-stitching.service';
import { SupabaseService } from '../../supabase/supabase.service';

describe('IdentityStitchingService', () => {
  let service: IdentityStitchingService;
  let mockQueryBuilder: Record<string, jest.Mock>;

  beforeEach(async () => {
    // Build a fresh chainable mock for each test so .select() resolution
    // can be configured per-call without leaking between tests.
    mockQueryBuilder = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      not: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null }),
      upsert: jest.fn().mockResolvedValue({ error: null }),
      update: jest.fn().mockReturnThis(),
    };

    const mockSupabaseService = {
      getClient: jest.fn(() => mockQueryBuilder),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdentityStitchingService,
        { provide: SupabaseService, useValue: mockSupabaseService },
      ],
    }).compile();

    service = module.get<IdentityStitchingService>(IdentityStitchingService);
  });

  // ---------------------------------------------------------------------------
  // Happy path: links visitor to user with full data
  // ---------------------------------------------------------------------------

  describe('linkVisitorToUser', () => {
    it('creates identity record and backfills sessions and events', async () => {
      // First .from('user_sessions').select('started_at...').maybeSingle()
      // returns earliest session data
      let fromCallCount = 0;
      mockQueryBuilder.from.mockImplementation((table: string) => {
        fromCallCount++;
        return mockQueryBuilder;
      });

      // The service calls maybeSingle once (earliest session), then
      // multiple selects that resolve as arrays. We track via select calls.
      let selectCallCount = 0;
      mockQueryBuilder.select.mockImplementation((fields: string) => {
        selectCallCount++;

        if (selectCallCount === 1) {
          // First select: earliest session query -> returns via maybeSingle
          mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
            data: {
              started_at: '2025-01-01T00:00:00Z',
              entry_type: 'organic',
              utm_source: 'google',
            },
          });
        }

        // For the second select (all sessions query) we need to resolve
        // the chain itself. We'll handle it via the eq mock terminal.
        return mockQueryBuilder;
      });

      // The second .eq('visitor_id', visitorId) call (for counting sessions)
      // needs to resolve with data. We use a different approach:
      // Override the chain so the await on the final chain resolves.
      // Since the code does `const { data: allSessions } = await client.from(...).select(...).eq(...)`,
      // the eq call must return a thenable.
      let eqCallCount = 0;
      mockQueryBuilder.eq.mockImplementation(() => {
        eqCallCount++;
        // The 2nd eq call (after select('session_id').eq('visitor_id', ...))
        // should resolve with session list
        if (eqCallCount === 2) {
          return Promise.resolve({
            data: [{ session_id: 's1' }, { session_id: 's2' }],
          });
        }
        return mockQueryBuilder;
      });

      // For backfill update calls, .is('user_id', null).select('...') resolves
      let isCallCount = 0;
      mockQueryBuilder.is.mockImplementation(() => {
        isCallCount++;
        // Return a mock that resolves with updated rows
        return {
          ...mockQueryBuilder,
          select: jest.fn().mockResolvedValue({
            data: [{ session_id: 's1' }],
          }),
        };
      });

      await service.linkVisitorToUser('visitor-abc', 'user-xyz');

      // Verify upsert was called for visitor_identities
      expect(mockQueryBuilder.from).toHaveBeenCalledWith('visitor_identities');
      expect(mockQueryBuilder.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          visitor_id: 'visitor-abc',
          user_id: 'user-xyz',
          acquisition_source: 'google',
          sessions_before_identification: 2,
        }),
        { onConflict: 'visitor_id,user_id' },
      );

      // Verify backfill updates were attempted on sessions and events
      expect(mockQueryBuilder.from).toHaveBeenCalledWith('user_sessions');
      expect(mockQueryBuilder.from).toHaveBeenCalledWith('user_events');
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({
        user_id: 'user-xyz',
      });
    });

    it('falls back to entry_type when utm_source is null', async () => {
      let selectCallCount = 0;
      mockQueryBuilder.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          mockQueryBuilder.maybeSingle.mockResolvedValueOnce({
            data: {
              started_at: '2025-01-01T00:00:00Z',
              entry_type: 'referral',
              utm_source: null,
            },
          });
        }
        return mockQueryBuilder;
      });

      let eqCallCount = 0;
      mockQueryBuilder.eq.mockImplementation(() => {
        eqCallCount++;
        if (eqCallCount === 2) {
          return Promise.resolve({ data: [] });
        }
        return mockQueryBuilder;
      });

      mockQueryBuilder.is.mockImplementation(() => ({
        ...mockQueryBuilder,
        select: jest.fn().mockResolvedValue({ data: [] }),
      }));

      await service.linkVisitorToUser('visitor-abc', 'user-xyz');

      expect(mockQueryBuilder.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          acquisition_source: 'referral',
        }),
        expect.any(Object),
      );
    });

    it('uses "direct" when no session data is found', async () => {
      mockQueryBuilder.maybeSingle.mockResolvedValue({ data: null });

      let eqCallCount = 0;
      mockQueryBuilder.eq.mockImplementation(() => {
        eqCallCount++;
        if (eqCallCount === 2) {
          return Promise.resolve({ data: null });
        }
        return mockQueryBuilder;
      });

      mockQueryBuilder.is.mockImplementation(() => ({
        ...mockQueryBuilder,
        select: jest.fn().mockResolvedValue({ data: null }),
      }));

      await service.linkVisitorToUser('visitor-abc', 'user-xyz');

      expect(mockQueryBuilder.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          acquisition_source: 'direct',
          sessions_before_identification: 0,
        }),
        expect.any(Object),
      );
    });
  });
});
