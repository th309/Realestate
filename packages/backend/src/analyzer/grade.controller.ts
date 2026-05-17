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
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  BUY_AND_HOLD_DEFAULTS,
  FIX_AND_FLIP_DEFAULTS,
  computeFlipUpgradePath,
  computeUpgradePath,
  type DealGradingResult,
  type DealInput,
  type FixAndFlipContext,
  type FixAndFlipThresholds,
  type FlipUpgradePathResult,
  type GradingContext,
  type Strategy,
  type UpgradePathResult,
  type UserThresholds,
} from '@propertyiq/analyzer-core';
import { JwtAuthGuard } from '../common/guards';
import { AuthUserId } from '../common/decorators';
import { SupabaseService } from '../supabase/supabase.service';
import { GradingService, type StrategyThresholds } from './grading.service';
import { ThresholdsService } from './thresholds.service';
import { GradeDealDto } from './dto/grade-deal.dto';
import { GradeFlipDealDto } from './dto/grade-flip-deal.dto';
import { UpgradePathDto } from './dto/upgrade-path.dto';
import { UpgradePathFlipDto } from './dto/upgrade-path-flip.dto';
import { UserThresholdsDto } from './dto/user-thresholds.dto';
import { FixAndFlipThresholdsDto } from './dto/fix-and-flip-thresholds.dto';
import { mapFlipDtoToEngine } from './grading.service';

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
   * POST /api/analyzer/grade-flip
   *
   * Fix & Flip-specific grading endpoint. Kept separate from /grade so the
   * (frozen, proven) B&H DTO validation isn't perturbed by F&F shape work.
   * Service-layer routing is identical — both endpoints land in
   * GradingService.gradeDeal which dispatches by strategy.
   */
  @Post('grade-flip')
  async gradeFlip(
    @Req() req: Request,
    @Body() body: GradeFlipDealDto,
  ): Promise<DealGradingResult> {
    const userId = await this.extractOptionalUserId(req);
    // Forward to the shared service router. The service trusts the
    // strategy discriminator and dispatches to gradeFixAndFlipDeal.
    return this.grading.gradeDeal(body as unknown as GradeDealDto, userId);
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
    if (body.strategy !== 'BUY_AND_HOLD') {
      throw new BadRequestException(
        `upgrade-path is currently only supported for BUY_AND_HOLD (got "${body.strategy}"). Use /upgrade-path-flip for FIX_AND_FLIP.`,
      );
    }
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
      thresholds as UserThresholds,
    );
  }

  /**
   * POST /api/analyzer/upgrade-path-flip
   *
   * F&F upgrade-path engine. Levers: purchase price (negotiate below ask),
   * rehab cost (re-bid / value engineer), ARV (re-comp with strict comps),
   * hold months (tighten project schedule). Bounds + feasibility bands are
   * calibrated to flipper realities, not adapted from rental investor logic.
   */
  @Post('upgrade-path-flip')
  async upgradePathFlip(
    @Req() req: Request,
    @Body() body: UpgradePathFlipDto,
  ): Promise<FlipUpgradePathResult> {
    const userId = await this.extractOptionalUserId(req);
    const thresholds = await this.grading.resolveThresholds(
      'FIX_AND_FLIP',
      userId,
      body.overrideThresholds as FixAndFlipThresholds | undefined,
    );
    return computeFlipUpgradePath(
      mapFlipDtoToEngine(body.input),
      (body.context ?? {}) as FixAndFlipContext,
      body.targetGrade,
      thresholds as FixAndFlipThresholds,
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
  ): Promise<StrategyThresholds> {
    this.validateStrategy(strategy);
    const saved = await this.thresholds.getThresholds(userId, strategy);
    if (saved) return saved as StrategyThresholds;
    return strategy === 'FIX_AND_FLIP'
      ? FIX_AND_FLIP_DEFAULTS
      : BUY_AND_HOLD_DEFAULTS;
  }

  /**
   * PUT /api/analyzer/thresholds/:strategy
   *
   * Upsert the caller's thresholds for the strategy. Validation is strategy-
   * aware: BUY_AND_HOLD bodies must match the B&H rubric shape; FIX_AND_FLIP
   * bodies must match the F&F rubric shape. Cross-shape submissions (e.g.,
   * B&H keys on a flip strategy) return 400. Both shapes enforce
   * grade ordering (A>B>C>D per direction) and weights summing to 100.
   */
  @Put('thresholds/:strategy')
  @UseGuards(JwtAuthGuard)
  async putThresholds(
    @AuthUserId() userId: string,
    @Param('strategy') strategy: string,
    @Body() body: unknown,
  ): Promise<StrategyThresholds> {
    this.validateStrategy(strategy);
    const validated = this.validateThresholdsForStrategy(strategy, body);
    return this.thresholds.upsertThresholds(
      userId,
      strategy,
      validated as UserThresholds,
    ) as Promise<StrategyThresholds>;
  }

  /**
   * Strategy-aware validation. Picks the right DTO class, runs class-validator
   * synchronously, and surfaces the first failed constraint as a 400 reason.
   */
  private validateThresholdsForStrategy(
    strategy: Strategy,
    body: unknown,
  ): StrategyThresholds {
    if (body == null || typeof body !== 'object') {
      throw new BadRequestException('thresholds body must be an object');
    }
    if (strategy === 'BRRRR') {
      throw new BadRequestException(
        'BRRRR threshold saving is not yet supported.',
      );
    }
    const DtoClass: new () => object =
      strategy === 'FIX_AND_FLIP' ? FixAndFlipThresholdsDto : UserThresholdsDto;
    const instance = plainToInstance(DtoClass, body);
    const errors = validateSync(instance, {
      whitelist: false,
      forbidNonWhitelisted: false,
    });
    if (errors.length > 0) {
      const first = errors[0];
      const constraintMsg = first.constraints
        ? Object.values(first.constraints)[0]
        : 'invalid';
      throw new BadRequestException(
        `${first.property}: ${constraintMsg} (strategy=${strategy})`,
      );
    }
    return instance as unknown as StrategyThresholds;
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
