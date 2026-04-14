import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EventIngestionService } from './event-ingestion.service';

/**
 * Emits analytics events from backend code paths (cron jobs, webhooks, service callbacks).
 *
 * Uses synthetic server-side visitor_id/session_id prefixed with "server:" and
 * "server-session:" so these events are distinguishable from frontend events in
 * user_events. The payload matches the IngestableEvent shape consumed by
 * EventIngestionService.ingestBatch() — note that the ingestion layer expects
 * `timestamp` (which it maps to `created_at` on insert).
 *
 * Fire-and-forget semantics: never throws. Analytics failures must not break
 * business logic.
 */
@Injectable()
export class ServerEventEmitterService {
  private readonly logger = new Logger(ServerEventEmitterService.name);

  constructor(private readonly ingestion: EventIngestionService) {}

  async emit(
    category: string,
    action: string,
    userId: string,
    properties: Record<string, unknown> = {},
  ): Promise<void> {
    try {
      await this.ingestion.ingestBatch([
        {
          client_event_id: randomUUID(),
          visitor_id: `server:${userId}`,
          session_id: `server-session:${userId}`,
          user_id: userId,
          event_category: category,
          event_action: action,
          properties,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      this.logger.warn(
        `Failed to emit ${category}.${action} for user ${userId}: ${(err as Error).message}`,
      );
    }
  }
}
