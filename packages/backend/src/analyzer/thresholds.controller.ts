/**
 * ThresholdsController — user-thresholds CRUD for the analyzer rubrics.
 * Split out of GradeController to keep both files under the CLAUDE.md §1.3
 * logic-file limit. Same base path (`/api/analyzer`), same ValidationPipe.
 *
 * Endpoints:
 *   GET    /api/analyzer/thresholds/:strategy   (JwtAuthGuard)
 *   PUT    /api/analyzer/thresholds/:strategy   (JwtAuthGuard)
 *   DELETE /api/analyzer/thresholds/:strategy   (JwtAuthGuard)
 *
 * Validation is strategy-aware: each strategy's body must match its own
 * rubric shape (B&H vs F&F vs BRRRR). Cross-shape submissions return 400.
 */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  BRRRR_DEFAULTS,
  BUY_AND_HOLD_DEFAULTS,
  FIX_AND_FLIP_DEFAULTS,
  type Strategy,
  type UserThresholds,
} from '@propertyiq/analyzer-core';
import { JwtAuthGuard } from '../common/guards';
import { AuthUserId } from '../common/decorators';
import { type StrategyThresholds } from './grading.service';
import { ThresholdsService } from './thresholds.service';
import { UserThresholdsDto } from './dto/user-thresholds.dto';
import { FixAndFlipThresholdsDto } from './dto/fix-and-flip-thresholds.dto';
import { BrrrrThresholdsDto } from './dto/brrrr-thresholds.dto';

const VALID_STRATEGIES: ReadonlySet<Strategy> = new Set<Strategy>([
  'BUY_AND_HOLD',
  'FIX_AND_FLIP',
  'BRRRR',
]);

@Controller('api/analyzer')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class ThresholdsController {
  constructor(private readonly thresholds: ThresholdsService) {}

  private validateStrategy(strategy: string): asserts strategy is Strategy {
    if (!VALID_STRATEGIES.has(strategy as Strategy)) {
      throw new BadRequestException(
        `invalid strategy "${strategy}" (expected one of: ${[...VALID_STRATEGIES].join(', ')})`,
      );
    }
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
    if (strategy === 'FIX_AND_FLIP') return FIX_AND_FLIP_DEFAULTS;
    if (strategy === 'BRRRR') return BRRRR_DEFAULTS;
    return BUY_AND_HOLD_DEFAULTS;
  }

  /**
   * PUT /api/analyzer/thresholds/:strategy
   *
   * Upsert the caller's thresholds. Validation is strategy-aware — each shape
   * is validated against its own DTO; cross-shape submissions return 400.
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
    let DtoClass: new () => object;
    if (strategy === 'FIX_AND_FLIP') DtoClass = FixAndFlipThresholdsDto;
    else if (strategy === 'BRRRR') DtoClass = BrrrrThresholdsDto;
    else DtoClass = UserThresholdsDto;

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
