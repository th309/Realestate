/**
 * GradeController — grading + upgrade-path endpoints. User-thresholds CRUD
 * lives in the sibling ThresholdsController (split per CLAUDE.md §1.3).
 *
 * Endpoints:
 *   POST /api/analyzer/grade                (optional auth)
 *   POST /api/analyzer/grade-flip           (optional auth)
 *   POST /api/analyzer/grade-brrrr          (optional auth)
 *   POST /api/analyzer/upgrade-path         (optional auth, B&H only)
 *   POST /api/analyzer/upgrade-path-flip    (optional auth, F&F)
 *   POST /api/analyzer/upgrade-path-brrrr   (optional auth, BRRRR)
 */
import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  computeBrrrrUpgradePath,
  computeFlipUpgradePath,
  computeUpgradePath,
  type BrrrrContext,
  type BrrrrThresholds,
  type BrrrrUpgradePathResult,
  type DealGradingResult,
  type DealInput,
  type FixAndFlipContext,
  type FixAndFlipThresholds,
  type FlipUpgradePathResult,
  type GradingContext,
  type UpgradePathResult,
  type UserThresholds,
} from '@propertyiq/analyzer-core';
import { SupabaseService } from '../supabase/supabase.service';
import { GradingService } from './grading.service';
import { mapBrrrrDtoToEngine } from './brrrr-mapper';
import { GradeDealDto } from './dto/grade-deal.dto';
import { GradeFlipDealDto } from './dto/grade-flip-deal.dto';
import { GradeBrrrrDealDto } from './dto/grade-brrrr-deal.dto';
import { UpgradePathDto } from './dto/upgrade-path.dto';
import { UpgradePathFlipDto } from './dto/upgrade-path-flip.dto';
import { UpgradePathBrrrrDto } from './dto/upgrade-path-brrrr.dto';
import { mapFlipDtoToEngine } from './grading.service';

@Controller('api/analyzer')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class GradeController {
  constructor(
    private readonly grading: GradingService,
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
   * POST /api/analyzer/grade-brrrr
   *
   * BRRRR-specific grading endpoint. Same separate-endpoint pattern as
   * /grade-flip — keeps the B&H and F&F validation paths frozen while BRRRR
   * iterates. Service-layer routing dispatches by strategy.
   */
  @Post('grade-brrrr')
  async gradeBrrrr(
    @Req() req: Request,
    @Body() body: GradeBrrrrDealDto,
  ): Promise<DealGradingResult> {
    const userId = await this.extractOptionalUserId(req);
    return this.grading.gradeDeal(body as unknown as GradeDealDto, userId);
  }

  /**
   * POST /api/analyzer/upgrade-path-brrrr
   *
   * BRRRR upgrade-path engine. Levers: purchasePrice, arv, rehabCost,
   * refiLtvPct, monthlyRent, holdMonthsBeforeRefi, refiRate.
   */
  @Post('upgrade-path-brrrr')
  async upgradePathBrrrr(
    @Req() req: Request,
    @Body() body: UpgradePathBrrrrDto,
  ): Promise<BrrrrUpgradePathResult> {
    const userId = await this.extractOptionalUserId(req);
    const thresholds = await this.grading.resolveThresholds(
      'BRRRR',
      userId,
      body.overrideThresholds as BrrrrThresholds | undefined,
    );
    return computeBrrrrUpgradePath(
      mapBrrrrDtoToEngine(body.input),
      (body.context ?? {}) as BrrrrContext,
      body.targetGrade,
      thresholds as BrrrrThresholds,
    );
  }
}
