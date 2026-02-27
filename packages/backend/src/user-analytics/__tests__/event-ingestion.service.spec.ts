/**
 * EventIngestionService Unit Tests
 *
 * Tests batch event ingestion including:
 * - Validation: rejecting events missing required fields
 * - Heartbeat separation: heartbeats routed to session keepalive
 * - Regular event insertion: valid events inserted into user_events
 * - Session upsert: sessions grouped and upserted per session_id
 * - Identity stitching trigger: signup_complete events link visitor to user
 */

import { Test, TestingModule } from '@nestjs/testing';
import { EventIngestionService } from '../event-ingestion.service';
import { SessionManagerService } from '../session-manager.service';
import { IdentityStitchingService } from '../identity-stitching.service';
import { SupabaseService } from '../../supabase/supabase.service';

// Chainable Supabase query builder mock
const mockQueryBuilder = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
  not: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn(),
  upsert: jest.fn().mockResolvedValue({ error: null }),
  insert: jest.fn().mockResolvedValue({ error: null }),
  update: jest.fn().mockReturnThis(),
};

const mockSupabaseService = {
  getClient: jest.fn(() => mockQueryBuilder),
};

const mockSessionManager = {
  updateHeartbeat: jest.fn().mockResolvedValue(undefined),
  upsertSession: jest.fn().mockResolvedValue(undefined),
};

const mockIdentityStitching = {
  linkVisitorToUser: jest.fn().mockResolvedValue(undefined),
};

describe('EventIngestionService', () => {
  let service: EventIngestionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventIngestionService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: SessionManagerService, useValue: mockSessionManager },
        {
          provide: IdentityStitchingService,
          useValue: mockIdentityStitching,
        },
      ],
    }).compile();

    service = module.get<EventIngestionService>(EventIngestionService);
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  describe('ingestBatch validation', () => {
    it('rejects events missing event_category', async () => {
      const result = await service.ingestBatch([
        { event_action: 'click', session_id: 's1' },
      ]);

      expect(result.accepted).toBe(0);
      expect(result.rejected).toBe(1);
    });

    it('rejects events missing event_action', async () => {
      const result = await service.ingestBatch([
        { event_category: 'pageview', session_id: 's1' },
      ]);

      expect(result.accepted).toBe(0);
      expect(result.rejected).toBe(1);
    });

    it('rejects events missing session_id', async () => {
      const result = await service.ingestBatch([
        { event_category: 'pageview', event_action: 'view' },
      ]);

      expect(result.accepted).toBe(0);
      expect(result.rejected).toBe(1);
    });

    it('rejects null and non-object values', async () => {
      const result = await service.ingestBatch([null, 42, 'string', undefined]);

      expect(result.accepted).toBe(0);
      expect(result.rejected).toBe(4);
    });

    it('accepts valid events and counts correctly', async () => {
      const validEvent = {
        event_category: 'pageview',
        event_action: 'view',
        session_id: 's1',
        visitor_id: 'v1',
      };

      const result = await service.ingestBatch([
        validEvent,
        { bad: true }, // rejected
      ]);

      expect(result.accepted).toBe(1);
      expect(result.rejected).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Heartbeat separation
  // ---------------------------------------------------------------------------

  describe('heartbeat processing', () => {
    it('routes heartbeat events to session keepalive instead of inserting', async () => {
      const heartbeat = {
        event_category: 'heartbeat',
        event_action: 'ping',
        session_id: 's1',
        visitor_id: 'v1',
      };

      await service.ingestBatch([heartbeat]);

      expect(mockSessionManager.updateHeartbeat).toHaveBeenCalledWith('s1');
      // Heartbeats should NOT be inserted into user_events since regular array is empty
      expect(mockQueryBuilder.upsert).not.toHaveBeenCalled();
    });

    it('deduplicates heartbeat session IDs', async () => {
      const heartbeats = [
        {
          event_category: 'heartbeat',
          event_action: 'ping',
          session_id: 's1',
          visitor_id: 'v1',
        },
        {
          event_category: 'heartbeat',
          event_action: 'ping',
          session_id: 's1',
          visitor_id: 'v1',
        },
      ];

      await service.ingestBatch(heartbeats);

      // Only one heartbeat call per unique session_id
      expect(mockSessionManager.updateHeartbeat).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Regular event insertion
  // ---------------------------------------------------------------------------

  describe('regular event insertion', () => {
    it('inserts non-heartbeat events into user_events via upsert', async () => {
      const event = {
        event_category: 'pageview',
        event_action: 'view',
        session_id: 's1',
        visitor_id: 'v1',
        page_path: '/home',
      };

      await service.ingestBatch([event]);

      expect(mockQueryBuilder.from).toHaveBeenCalledWith('user_events');
      expect(mockQueryBuilder.upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            session_id: 's1',
            visitor_id: 'v1',
            event_category: 'pageview',
            event_action: 'view',
            page_path: '/home',
          }),
        ]),
        expect.objectContaining({
          onConflict: 'session_id,client_event_id',
          ignoreDuplicates: true,
        }),
      );
    });

    it('upserts sessions grouped by session_id', async () => {
      const events = [
        {
          event_category: 'pageview',
          event_action: 'view',
          session_id: 's1',
          visitor_id: 'v1',
        },
        {
          event_category: 'feature',
          event_action: 'map_click',
          session_id: 's1',
          visitor_id: 'v1',
        },
        {
          event_category: 'pageview',
          event_action: 'view',
          session_id: 's2',
          visitor_id: 'v2',
        },
      ];

      await service.ingestBatch(events);

      // Two distinct sessions should trigger two upsertSession calls
      expect(mockSessionManager.upsertSession).toHaveBeenCalledTimes(2);
      expect(mockSessionManager.upsertSession).toHaveBeenCalledWith(
        's1',
        expect.any(Array),
      );
      expect(mockSessionManager.upsertSession).toHaveBeenCalledWith(
        's2',
        expect.any(Array),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Identity stitching trigger
  // ---------------------------------------------------------------------------

  describe('identity stitching on signup_complete', () => {
    it('triggers linkVisitorToUser when signup_complete event has visitor_id and user_id', async () => {
      const signupEvent = {
        event_category: 'conversion',
        event_action: 'signup_complete',
        session_id: 's1',
        visitor_id: 'v1',
        user_id: 'u1',
      };

      await service.ingestBatch([signupEvent]);

      expect(mockIdentityStitching.linkVisitorToUser).toHaveBeenCalledWith(
        'v1',
        'u1',
      );
    });

    it('does not trigger identity stitching for non-signup events', async () => {
      const event = {
        event_category: 'pageview',
        event_action: 'view',
        session_id: 's1',
        visitor_id: 'v1',
        user_id: 'u1',
      };

      await service.ingestBatch([event]);

      expect(mockIdentityStitching.linkVisitorToUser).not.toHaveBeenCalled();
    });

    it('supports event_type/event_name backwards compatibility mapping', async () => {
      const legacyEvent = {
        event_type: 'conversion',
        event_name: 'signup_complete',
        session_id: 's1',
        visitor_id: 'v1',
        user_id: 'u1',
      };

      await service.ingestBatch([legacyEvent]);

      expect(mockIdentityStitching.linkVisitorToUser).toHaveBeenCalledWith(
        'v1',
        'u1',
      );
    });
  });
});
