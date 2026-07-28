import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { EventIngestionService } from './event-ingestion.service';
import { SessionManagerService } from './session-manager.service';

/** Real browser User-Agents are a few hundred bytes; anything longer is noise. */
const MAX_USER_AGENT_LENGTH = 512;

@Controller('api/usage')
export class EventIngestionController {
  private readonly logger = new Logger(EventIngestionController.name);

  constructor(
    private readonly ingestion: EventIngestionService,
    private readonly sessionManager: SessionManagerService,
  ) {}

  @Post('events')
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  @HttpCode(202)
  async ingestEvents(
    @Body() body: { events: unknown[] },
    // Forwarded by the same-origin proxy. The direct `user-agent` header here
    // belongs to the Next.js server, not the visitor, so it cannot be used for
    // bot classification.
    @Headers('x-client-user-agent') clientUserAgent?: string,
  ) {
    if (!body.events || !Array.isArray(body.events)) {
      return { success: false, error: 'events array required' };
    }
    if (body.events.length > 50) {
      return { success: false, error: 'max 50 events per batch' };
    }
    // Cap before use. A legitimate User-Agent is a few hundred bytes at most;
    // this is only ever substring-scanned to compute a boolean and never stored
    // or rendered, but bounding it keeps an oversized header from being carried
    // through the ingestion path.
    const result = await this.ingestion.ingestBatch(
      body.events,
      (clientUserAgent ?? '').slice(0, MAX_USER_AGENT_LENGTH),
    );
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
