/**
 * ServerEventEmitterService Unit Tests
 *
 * Verifies:
 * - Server-side events use synthetic visitor_id/session_id prefixes
 *   ("server:<userId>" / "server-session:<userId>") so they are
 *   distinguishable from frontend events in user_events.
 * - Event payload matches the IngestableEvent shape consumed by
 *   EventIngestionService.ingestBatch().
 * - Properties default to an empty object when omitted.
 * - Fire-and-forget semantics: ingestion failures must never propagate
 *   so analytics issues cannot break business logic.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ServerEventEmitterService } from '../server-event-emitter.service';
import { EventIngestionService } from '../event-ingestion.service';

describe('ServerEventEmitterService', () => {
  let service: ServerEventEmitterService;
  const mockIngestion = {
    ingestBatch: jest.fn().mockResolvedValue({ accepted: 1, rejected: 0 }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockIngestion.ingestBatch.mockResolvedValue({ accepted: 1, rejected: 0 });
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        ServerEventEmitterService,
        { provide: EventIngestionService, useValue: mockIngestion },
      ],
    }).compile();
    service = mod.get(ServerEventEmitterService);
  });

  it('emits with server visitor_id + user_id + expected shape', async () => {
    await service.emit('trial', 'started', 'user-123', {
      trial_duration_days: 14,
    });

    expect(mockIngestion.ingestBatch).toHaveBeenCalledTimes(1);
    const [events] = mockIngestion.ingestBatch.mock.calls[0];
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      visitor_id: 'server:user-123',
      user_id: 'user-123',
      event_category: 'trial',
      event_action: 'started',
      properties: { trial_duration_days: 14 },
    });
    expect(events[0].client_event_id).toBeTruthy();
    expect(events[0].session_id).toMatch(/^server-session:/);
    // IngestableEvent shape uses `timestamp`, not `created_at`
    expect(events[0].timestamp).toBeTruthy();
  });

  it('defaults properties to empty object', async () => {
    await service.emit('trial', 'expired', 'user-456');
    const [events] = mockIngestion.ingestBatch.mock.calls[0];
    expect(events[0].properties).toEqual({});
  });

  it('does not throw when ingestion fails (analytics must never break business logic)', async () => {
    mockIngestion.ingestBatch.mockRejectedValueOnce(new Error('DB down'));
    await expect(
      service.emit('trial', 'started', 'user-789'),
    ).resolves.not.toThrow();
  });
});
