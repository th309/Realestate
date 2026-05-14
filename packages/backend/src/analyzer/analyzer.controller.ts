import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Post,
  Query,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { SupabaseClient } from '@supabase/supabase-js';
import { JwtAuthGuard } from '../common/guards';
import { AuthUserId } from '../common/decorators';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import { AnalyzerService } from './analyzer.service';
import { MarketContextQueryDto } from './dto/market-context.dto';
import { AiVerdictRequestDto } from './dto/ai-verdict.dto';

/**
 * Tiers allowed to invoke the AI verdict endpoint. Mirrors the in-controller
 * `requireTier` pattern used by `UserApiKeysController` — the codebase does
 * not yet have a shared Pro-tier guard, so we replicate that pattern rather
 * than invent one.
 */
const VERDICT_ALLOWED_TIERS = ['pro', 'enterprise', 'admin'];

@Controller('api/analyzer')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AnalyzerController {
  constructor(
    private readonly service: AnalyzerService,
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
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
   * Resolve the user's subscription tier from `user_profiles` and 403 if
   * they aren't Pro-or-better. Mirrors `UserApiKeysController.requireTier`.
   */
  private async requireProTier(userId: string): Promise<void> {
    const { data } = await this.supabase
      .from('user_profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .single();

    const tier = data?.subscription_tier ?? 'free';
    if (!VERDICT_ALLOWED_TIERS.includes(tier)) {
      throw new ForbiddenException(
        `AI verdict requires a Pro or Enterprise subscription. Current tier: ${tier}`,
      );
    }
  }
}
