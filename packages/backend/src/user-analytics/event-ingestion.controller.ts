import { Controller, Post, Body, HttpCode, Logger } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EventIngestionService } from './event-ingestion.service';
import { SessionManagerService } from './session-manager.service';

@Controller('api/analytics')
export class EventIngestionController {
  private readonly logger = new Logger(EventIngestionController.name);

  constructor(
    private readonly ingestion: EventIngestionService,
    private readonly sessionManager: SessionManagerService,
  ) {}

  @Post('events')
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  @HttpCode(202)
  async ingestEvents(@Body() body: { events: unknown[] }) {
    if (!body.events || !Array.isArray(body.events)) {
      return { success: false, error: 'events array required' };
    }
    if (body.events.length > 50) {
      return { success: false, error: 'max 50 events per batch' };
    }
    const result = await this.ingestion.ingestBatch(body.events);
    return { success: true, ...result };
  }

  @Post('heartbeat')
  @Throttle({ default: { limit: 200, ttl: 60000 } })
  @HttpCode(204)
  async heartbeat(@Body() body: { session_id?: string; visitor_id?: string }) {
    if (body.session_id) {
      await this.sessionManager.updateHeartbeat(body.session_id);
    }
  }
}
