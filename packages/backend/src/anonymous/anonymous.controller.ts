import { Body, Controller, Logger, Post, UseGuards } from '@nestjs/common';
import { GeneratePresentationDto } from './dto/generate-presentation.dto';
import {
  ListingPresentationService,
  GeoLevel,
} from './listing-presentation.service';
import { RedisTourCacheService } from './redis-tour-cache.service';
import { AnonRateLimitGuard } from './anon-rate-limit.guard';

@Controller('api/anonymous')
export class AnonymousController {
  private logger = new Logger(AnonymousController.name);

  constructor(
    private listing: ListingPresentationService,
    private cache: RedisTourCacheService,
  ) {}

  // NOTE: A parallel agent is editing listing-presentation.service.ts (T9
  // orchestrator fix). To avoid merge conflicts we keep cache row assembly
  // here in the controller for now — the small coupling cost is intentional.
  // Move createdAt + claimedBy defaults into the service in a follow-up once
  // that work has landed.
  @Post('listing-presentation')
  @UseGuards(AnonRateLimitGuard)
  async generate(@Body() dto: GeneratePresentationDto) {
    // DTO validates geoLevel via @IsIn(['metro','county','city','zip']),
    // so the narrow at this boundary is safe.
    const result = await this.listing.generate({
      sessionId: dto.sessionId,
      persona: dto.persona,
      market: {
        geoLevel: dto.market.geoLevel as GeoLevel,
        geoId: dto.market.geoId,
        name: dto.market.name,
      },
    });

    // Best-effort cache write. If Redis is down or rejects, the user still
    // gets the report — they have the client-side payload and can re-claim
    // later by re-submitting the same sessionId. Failing the request would
    // burn their once-per-day rate-limit slot AND lose the report. Worse UX.
    try {
      await this.cache.set({
        sessionId: result.sessionId,
        reportId: result.reportId,
        persona: dto.persona,
        market: dto.market,
        reportPayload: result.report,
        createdAt: new Date().toISOString(),
        expiresAt: result.expiresAt,
        claimedBy: null,
      });
    } catch (err) {
      this.logger.warn(
        `Cache.set failed for session ${result.sessionId}; report still returned to client. error=${String(err)}`,
      );
    }

    return result;
  }
}
