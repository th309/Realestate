import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Logger,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/guards';
import { AuthUserId } from '../common/decorators';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { AnalyzerService } from './analyzer.service';
import { AnalyzerPersistenceService } from './analyzer.persistence.service';
import { MarketContextQueryDto } from './dto/market-context.dto';
import { AiVerdictRequestDto } from './dto/ai-verdict.dto';
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

/**
 * Tiers allowed to invoke the AI verdict endpoint. Tier resolution itself
 * goes through `EntitlementsService.getUserTier` so trial / org-tier /
 * admin-fallback rules stay consistent with the rest of the backend.
 */
const VERDICT_ALLOWED_TIERS = ['pro', 'enterprise', 'admin'];

@Controller('api/analyzer')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AnalyzerController {
  private readonly logger = new Logger(AnalyzerController.name);

  constructor(
    private readonly service: AnalyzerService,
    private readonly persistence: AnalyzerPersistenceService,
    private readonly entitlements: EntitlementsService,
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
    await this.requireProTier(userId);
    return this.service.lookupProperty(query.address);
  }

  /**
   * POST /api/analyzer/ai-verdict
   *
   * Streams an AI-generated deal verdict via Server-Sent Events.
   * Pro-gated: anonymous users are blocked by FreePreviewMiddleware,
   * logged-in users hit `requireProTier` below for a 403 on non-Pro tiers.
   *
   * Response is `text/event-stream`; each chunk is
   * `data: {"chunk":"..."}\n\n`. Stream terminates with `data: [DONE]\n\n`.
   * Errors mid-stream are emitted as `data: {"error":"..."}\n\n` before
   * the connection ends.
   */
  @Post('ai-verdict')
  @UseGuards(JwtAuthGuard)
  async aiVerdict(
    @AuthUserId() userId: string,
    @Body() body: AiVerdictRequestDto,
    @Res() res: Response,
  ): Promise<void> {
    await this.requireProTier(userId);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      for await (const chunk of this.service.streamAiVerdict(body)) {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    } finally {
      res.end();
    }
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
    await this.requireProTier(userId);
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

  /**
   * Resolve the user's effective tier via the cached `EntitlementsService`
   * (which delegates to `TierResolverService` for trial / org-tier /
   * admin-fallback resolution) and 403 if they aren't Pro-or-better.
   *
   * A `null` return from `getUserTier` means we have a userId but no
   * resolvable tier — typically a missing `user_profiles` row. Surface that
   * as a warning so we can spot orphaned auth users in production logs.
   */
  private async requireProTier(userId: string): Promise<void> {
    const resolved = await this.entitlements.getUserTier(userId);

    if (resolved == null) {
      this.logger.warn(
        `[Analyzer] requireProTier: no tier resolved for userId=${userId.substring(0, 8)}… — missing user_profiles row?`,
      );
    }

    const tier = resolved ?? 'free';
    if (!VERDICT_ALLOWED_TIERS.includes(tier)) {
      throw new ForbiddenException(
        `AI verdict requires a Pro or Enterprise subscription. Current tier: ${tier}`,
      );
    }
  }
}
