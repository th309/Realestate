import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards';
import { AuthUserId } from '../common/decorators';
import { AnalyzerService } from './analyzer.service';
import { AnalyzerPersistenceService } from './analyzer.persistence.service';
import { AnalyzerTierGate } from './analyzer-tier-gate.service';
import { MarketContextQueryDto } from './dto/market-context.dto';
import { AnalysisSnapshotDto } from './dto/analysis-snapshot.dto';
import { ListSavedQueryDto } from './dto/list-saved.dto';
import {
  PropertyLookupQueryDto,
  PropertyLookupDto,
} from './dto/property-lookup.dto';

/**
 * Share tokens are produced by `crypto.randomBytes(N).toString('base64url')`.
 * 16-byte tokens → 22 chars, 24-byte → 32 chars; allow up to 64 for future
 * widening. base64url charset only.
 */
const SHARE_TOKEN_REGEX = /^[A-Za-z0-9_-]{16,64}$/;

@Controller('api/analyzer')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AnalyzerController {
  constructor(
    private readonly service: AnalyzerService,
    private readonly persistence: AnalyzerPersistenceService,
    private readonly tierGate: AnalyzerTierGate,
  ) {}

  /**
   * GET /api/analyzer/market-context?zip=78704
   * GET /api/analyzer/market-context?county_fips=48453
   * GET /api/analyzer/market-context?state=TX
   *
   * Returns aggregated metric snapshot + PropertyIQ score for the
   * geography. Exactly one query parameter should be supplied; if none
   * match the validators an empty context is returned.
   */
  @Get('market-context')
  getMarketContext(@Query() query: MarketContextQueryDto) {
    return this.service.getMarketContext(query);
  }

  /**
   * GET /api/analyzer/property-lookup?address=<string>
   *
   * Pro-gated property snapshot from RentCast. Orchestrates 3 upstream
   * calls (record + AVM + rent estimate) via `Promise.allSettled` so a
   * partial failure (e.g. rent estimate unavailable) still returns the
   * surviving fields. The address is opaque to us — RentCast handles
   * parsing, geocoding, and matching.
   */
  @Get('property-lookup')
  @UseGuards(JwtAuthGuard)
  async lookupProperty(
    @AuthUserId() userId: string,
    @Query() query: PropertyLookupQueryDto,
  ): Promise<PropertyLookupDto> {
    await this.tierGate.requirePro(userId);
    return this.service.lookupProperty(query.address);
  }

  /**
   * POST /api/analyzer/save
   *
   * Persist an analyzer run for the authenticated user. Pro-gated — saved
   * analyses are part of the paid feature surface (see spec §9 tier matrix).
   */
  @Post('save')
  @UseGuards(JwtAuthGuard)
  async saveAnalysis(
    @AuthUserId() userId: string,
    @Body() body: AnalysisSnapshotDto,
  ) {
    await this.tierGate.requirePro(userId);
    return this.persistence.save(userId, body);
  }

  /**
   * GET /api/analyzer/saved?limit=20&cursor=<iso>
   *
   * List the caller's saved analyses, newest first. Auth-required but NOT
   * Pro-gated — free users may still view what they previously saved
   * during a Pro trial. Limit is clamped to 50.
   */
  @Get('saved')
  @UseGuards(JwtAuthGuard)
  async listSaved(@AuthUserId() userId: string, @Query() q: ListSavedQueryDto) {
    return this.persistence.list(userId, {
      limit: q.limit ?? 20,
      cursor: q.cursor,
    });
  }

  /**
   * GET /api/analyzer/saved/:id
   *
   * Fetch a single saved analysis owned by the caller. 404 if not found
   * or owned by someone else (RLS-equivalent enforcement happens in the
   * service via `eq('owner_id', userId)`).
   */
  @Get('saved/:id')
  @UseGuards(JwtAuthGuard)
  async getSaved(
    @AuthUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const row = await this.persistence.getOne(userId, id);
    if (!row) {
      throw new NotFoundException('analysis not found');
    }
    return row;
  }

  /**
   * DELETE /api/analyzer/saved/:id
   *
   * Delete a saved analysis owned by the caller. Idempotent.
   */
  @Delete('saved/:id')
  @UseGuards(JwtAuthGuard)
  async deleteSaved(
    @AuthUserId() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.persistence.remove(userId, id);
    return { ok: true };
  }

  /**
   * GET /api/analyzer/share/:token
   *
   * Public read of a shared analysis via SECURITY DEFINER RPC. No auth —
   * possession of the token is the entitlement. Returns 404 for unknown
   * or revoked tokens.
   */
  @Get('share/:token')
  async getShared(@Param('token') token: string) {
    if (!SHARE_TOKEN_REGEX.test(token)) {
      throw new BadRequestException('invalid token format');
    }
    const row = await this.persistence.getShared(token);
    if (!row) {
      throw new NotFoundException('shared analysis not found');
    }
    return row;
  }
}
