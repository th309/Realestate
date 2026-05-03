import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { GeneratePresentationDto } from './dto/generate-presentation.dto';
import { ListingPresentationService } from './listing-presentation.service';
import { RedisTourCacheService } from './redis-tour-cache.service';
import { AnonRateLimitGuard } from './anon-rate-limit.guard';

@Controller('api/anonymous')
export class AnonymousController {
  constructor(
    private listing: ListingPresentationService,
    private cache: RedisTourCacheService,
  ) {}

  @Post('listing-presentation')
  @UseGuards(AnonRateLimitGuard)
  async generate(@Body() dto: GeneratePresentationDto) {
    const result = await this.listing.generate({
      sessionId: dto.sessionId,
      persona: dto.persona,
      market: dto.market,
    });

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

    return result;
  }
}
