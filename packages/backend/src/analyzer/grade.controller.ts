/**
 * GradeController — split out of AnalyzerController to keep that file under
 * the CLAUDE.md §1.3 logic-file limit. Same base path (`/api/analyzer`), same
 * ValidationPipe configuration.
 *
 * Endpoints:
 *   POST   /api/analyzer/grade                  (optional auth)
 *   GET    /api/analyzer/thresholds/:strategy   (JwtAuthGuard)
 *   PUT    /api/analyzer/thresholds/:strategy   (JwtAuthGuard)
 *   DELETE /api/analyzer/thresholds/:strategy   (JwtAuthGuard)
 */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  BUY_AND_HOLD_DEFAULTS,
  computeUpgradePath,
  type DealGradingResult,
  type DealInput,
  type GradingContext,
  type Strategy,
  type UpgradePathResult,
  type UserThresholds,
} from '@propertyiq/analyzer-core';
import { JwtAuthGuard } from '../common/guards';
import { AuthUserId } from '../common/decorators';
import { SupabaseService } from '../supabase/supabase.service';
import { GradingService } from './grading.service';
import { ThresholdsService } from './thresholds.service';
import { GradeDealDto } from './dto/grade-deal.dto';
import { UpgradePathDto } from './dto/upgrade-path.dto';
import { UserThresholdsDto } from './dto/user-thresholds.dto';

const VALID_STRATEGIES: ReadonlySet<Strategy> = new Set<Strategy>([
  'BUY_AND_HOLD',
  'FIX_AND_FLIP',
  'BRRRR',
]);

@Controller('api/analyzer')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class GradeController {
  constructor(
    private readonly grading: GradingService,
    private readonly thresholds: ThresholdsService,
    private readonly supabase: SupabaseService,
  ) {}

  /**
   * Best-effort JWT validation for endpoints that allow anonymous access.
   * Returns the userId on a valid Bearer token, otherwise null. Never throws.
   * Mirrors `JwtAuthGuard.validateSupabaseJwt` semantics but degrades on
   * failure so anonymous callers continue to get the default rubric.
   */
  private async extractOptionalUserId(req: Request): Promise<string | null> {
    const authHeader = req.headers?.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.substring(7);
    try {
      const { data, error } = await this.supabase
        .getClient()
        .auth.getUser(token);
      if (error || !data.user) return null;
      return data.user.id;
    } catch {
      return null;
    }
  }

  private validateStrategy(strategy: string): asserts strategy is Strategy {
    if (!VALID_STRATEGIES.has(strategy as Strategy)) {
      throw new BadRequestException(
        `invalid strategy "${strategy}" (expected one of: ${[...VALID_STRATEGIES].join(', ')})`,
      );
    }
  }

  /**
   * POST /api/analyzer/grade
   *
   * Grade a single deal against the strategy's rubric. Optional auth:
   *   - anonymous → strategy-default preset
   *   - authenticated → user's saved thresholds, falling back to defaults
   *   - any caller may supply `overrideThresholds` to short-circuit both.
   */
  @Post('grade')
  async grade(
    @Req() req: Request,
    @Body() body: GradeDealDto,
  ): Promise<DealGradingResult> {
    const userId = await this.extractOptionalUserId(req);
    return this.grading.gradeDeal(body, userId);
  }

  /**
   * POST /api/analyzer/upgrade-path
   *
   * Given a current deal and a target grade letter, find the smallest
   * single-lever move (price / rent / down payment / rate) that lifts the
   * deal to the target. Reuses the same threshold resolution path as /grade
   * (override → saved → defaults), with the same optional-auth semantics.
   */
  @Post('upgrade-path')
  async upgradePath(
    @Req() req: Request,
    @Body() body: UpgradePathDto,
  ): Promise<UpgradePathResult> {
    const userId = await this.extractOptionalUserId(req);
    const thresholds = await this.grading.resolveThresholds(
      body.strategy,
      userId,
      body.overrideThresholds as UserThresholds | undefined,
    );
    return computeUpgradePath(
      body.input as DealInput,
      (body.context ?? {}) as GradingContext,
      body.targetGrade,
      thresholds,
    );
  }

  /**
   * GET /api/analyzer/thresholds/:strategy
   *
   * Returns the caller's saved thresholds for the strategy, or the default
   * preset when no row exists.
   */
  @Get('thresholds/:strategy')
  @UseGuards(JwtAuthGuard)
  async getThresholds(
    @AuthUserId() userId: string,
    @Param('strategy') strategy: string,
  ): Promise<UserThresholds> {
    this.validateStrategy(strategy);
    const saved = await this.thresholds.getThresholds(userId, strategy);
    return saved ?? BUY_AND_HOLD_DEFAULTS;
  }

  /**
   * PUT /api/analyzer/thresholds/:strategy
   *
   * Upsert the caller's thresholds for the strategy. DTO validation enforces
   * grade ordering (A>B>C>D per direction) and weights summing to 100.
   */
  @Put('thresholds/:strategy')
  @UseGuards(JwtAuthGuard)
  async putThresholds(
    @AuthUserId() userId: string,
    @Param('strategy') strategy: string,
    @Body() body: UserThresholdsDto,
  ): Promise<UserThresholds> {
    this.validateStrategy(strategy);
    return this.thresholds.upsertThresholds(
      userId,
      strategy,
      body as UserThresholds,
    );
  }

  /**
   * DELETE /api/analyzer/thresholds/:strategy
   *
   * Idempotent — reverts the strategy to default-preset behavior on the
   * caller's next GET / grade call.
   */
  @Delete('thresholds/:strategy')
  @UseGuards(JwtAuthGuard)
  async deleteThresholds(
    @AuthUserId() userId: string,
    @Param('strategy') strategy: string,
  ): Promise<{ ok: true }> {
    this.validateStrategy(strategy);
    await this.thresholds.deleteThresholds(userId, strategy);
    return { ok: true };
  }
}
