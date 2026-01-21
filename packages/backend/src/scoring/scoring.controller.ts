/**
 * PropertyIQ Scoring Controller
 *
 * API endpoints for PropertyIQ score calculation and retrieval.
 * Supports three score types:
 * - Market Health Index (free tier - available to all users)
 * - HomeReady Score (pro tier - requires upgrade for free/basic users)
 * - InvestorEdge Score (pro tier - requires upgrade for free/basic users)
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Headers,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiHeader } from '@nestjs/swagger';
import { ScoringService } from './scoring.service';
import { PercentileService } from './percentile.service';
import { ScoreAccessService, getScoreAccess } from './scoring.guard';
import {
  GeographyType,
  ScoreType,
  UserTier,
  PropertyIQScore,
  ComponentScore,
  MARKET_HEALTH_WEIGHTS,
  HOMEREADY_WEIGHTS,
  INVESTOREDGE_WEIGHTS,
} from './scoring.types';
import {
  ScoreBadgeResponseDto,
  ScoreCardResponseDto,
  ScoreTeaserResponseDto,
  AllScoresResponseDto,
  ComponentDetailDto,
  ConfidenceDto,
  LockedComponentDto,
  getScoreLabel,
  getComponentLabel,
  getComponentDescription,
  createUpgradeCta,
} from './dto/score-response.dto';

@ApiTags('scoring')
@Controller('api/scoring')
export class ScoringController {
  constructor(
    private readonly scoringService: ScoringService,
    private readonly percentileService: PercentileService,
    private readonly scoreAccessService: ScoreAccessService,
  ) {}

  /**
   * Get PropertyIQ scores for a specific geography
   *
   * GET /scoring/:geographyType/:geographyId
   * Returns all three scores with access control based on user tier
   */
  @Get(':geographyType/:geographyId')
  @ApiOperation({ summary: 'Get PropertyIQ scores for a geography' })
  @ApiParam({ name: 'geographyType', enum: ['state', 'metro', 'county', 'zip'] })
  @ApiParam({ name: 'geographyId', description: 'Geography identifier' })
  @ApiQuery({ name: 'type', required: false, enum: ['market_health', 'homeready', 'investoredge'] })
  @ApiQuery({ name: 'expanded', required: false, type: Boolean })
  @ApiQuery({ name: 'historyMonths', required: false, type: Number })
  @ApiQuery({ name: 'periodDate', required: false })
  @ApiQuery({ name: 'recalculate', required: false, type: Boolean })
  @ApiHeader({ name: 'x-user-tier', required: false, description: 'User subscription tier' })
  async getScore(
    @Param('geographyType') geographyType: string,
    @Param('geographyId') geographyId: string,
    @Headers('x-user-tier') userTierHeader?: string,
    @Query('type') scoreType?: string,
    @Query('expanded') expanded?: string,
    @Query('historyMonths') historyMonths?: string,
    @Query('periodDate') periodDate?: string,
    @Query('recalculate') recalculate?: string,
  ): Promise<AllScoresResponseDto> {
    const geoType = this.validateGeographyType(geographyType);
    const userTier = this.validateUserTier(userTierHeader);
    const isExpanded = expanded === 'true';

    // Get or calculate score
    let score: PropertyIQScore | null;

    if (recalculate === 'true') {
      score = await this.scoringService.calculateScore(
        geographyId,
        geoType,
        periodDate,
      );
    } else {
      score = await this.scoringService.getScore(
        geographyId,
        geoType,
        periodDate,
      );

      if (!score) {
        score = await this.scoringService.calculateScore(
          geographyId,
          geoType,
          periodDate,
        );
      }
    }

    if (!score) {
      throw new HttpException(
        `Unable to calculate score for ${geographyType}/${geographyId}`,
        HttpStatus.NOT_FOUND,
      );
    }

    // Build response with access control
    return this.buildAllScoresResponse(score, userTier, isExpanded);
  }

  /**
   * Get raw PropertyIQ score (internal/admin endpoint)
   *
   * GET /scoring/raw/:geographyType/:geographyId
   * Returns full score data without access control formatting
   */
  @Get('raw/:geographyType/:geographyId')
  @ApiOperation({ summary: 'Get raw PropertyIQ score data (admin)' })
  async getRawScore(
    @Param('geographyType') geographyType: string,
    @Param('geographyId') geographyId: string,
    @Query('periodDate') periodDate?: string,
    @Query('recalculate') recalculate?: string,
  ) {
    const geoType = this.validateGeographyType(geographyType);

    if (recalculate === 'true') {
      const score = await this.scoringService.calculateScore(
        geographyId,
        geoType,
        periodDate,
      );
      if (!score) {
        throw new HttpException(
          `Unable to calculate score for ${geographyType}/${geographyId}`,
          HttpStatus.NOT_FOUND,
        );
      }
      return score;
    }

    const cachedScore = await this.scoringService.getScore(
      geographyId,
      geoType,
      periodDate,
    );
    if (cachedScore) {
      return cachedScore;
    }

    const score = await this.scoringService.calculateScore(
      geographyId,
      geoType,
      periodDate,
    );
    if (!score) {
      throw new HttpException(
        `Unable to calculate score for ${geographyType}/${geographyId}`,
        HttpStatus.NOT_FOUND,
      );
    }
    return score;
  }

  /**
   * Calculate scores for all geographies of a specific type
   *
   * POST /scoring/calculate-all/:geographyType
   * Query params:
   *   - periodDate: Optional date (YYYY-MM-DD), defaults to latest
   */
  @Post('calculate-all/:geographyType')
  async calculateAllScores(
    @Param('geographyType') geographyType: string,
    @Query('periodDate') periodDate?: string,
  ) {
    const geoType = this.validateGeographyType(geographyType);
    const result = await this.scoringService.calculateAllScores(
      geoType,
      periodDate,
    );
    return {
      success: true,
      geographyType: geoType,
      periodDate,
      ...result,
    };
  }

  /**
   * Get scores for multiple geographies (batch endpoint)
   *
   * GET /scoring/batch/:geographyType
   * Query params:
   *   - ids: Comma-separated list of geography IDs
   *   - periodDate: Optional date (YYYY-MM-DD)
   */
  @Get('batch/:geographyType')
  async getBatchScores(
    @Param('geographyType') geographyType: string,
    @Query('ids') ids: string,
    @Query('periodDate') periodDate?: string,
  ) {
    if (!ids) {
      throw new HttpException(
        'ids query parameter is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const geoType = this.validateGeographyType(geographyType);
    const geographyIds = ids
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id);

    if (geographyIds.length === 0) {
      throw new HttpException(
        'At least one geography ID is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (geographyIds.length > 100) {
      throw new HttpException(
        'Maximum 100 geographies per batch request',
        HttpStatus.BAD_REQUEST,
      );
    }

    const scores = await Promise.all(
      geographyIds.map(async (id) => {
        try {
          const score = await this.scoringService.getScore(
            id,
            geoType,
            periodDate,
          );
          if (!score) {
            return { geographyId: id, error: 'Score not found' };
          }
          return score;
        } catch (err) {
          return { geographyId: id, error: 'Failed to retrieve score' };
        }
      }),
    );

    return {
      geographyType: geoType,
      periodDate,
      scores,
    };
  }

  /**
   * Compare scores between geographies
   *
   * GET /scoring/compare/:geographyType
   * Query params:
   *   - ids: Comma-separated list of geography IDs (2-5)
   *   - periodDate: Optional date (YYYY-MM-DD)
   */
  @Get('compare/:geographyType')
  async compareScores(
    @Param('geographyType') geographyType: string,
    @Query('ids') ids: string,
    @Query('periodDate') periodDate?: string,
  ) {
    if (!ids) {
      throw new HttpException(
        'ids query parameter is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const geoType = this.validateGeographyType(geographyType);
    const geographyIds = ids
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id);

    if (geographyIds.length < 2) {
      throw new HttpException(
        'At least 2 geography IDs required for comparison',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (geographyIds.length > 5) {
      throw new HttpException(
        'Maximum 5 geographies per comparison',
        HttpStatus.BAD_REQUEST,
      );
    }

    const scores = await Promise.all(
      geographyIds.map((id) =>
        this.scoringService.getScore(id, geoType, periodDate),
      ),
    );

    const validScores = scores.filter((s) => s !== null);

    if (validScores.length < 2) {
      throw new HttpException(
        'Not enough valid scores found for comparison',
        HttpStatus.NOT_FOUND,
      );
    }

    // Calculate rankings
    const homereadyRanked = [...validScores].sort(
      (a, b) => b.homereadyScore - a.homereadyScore,
    );
    const investoredgeRanked = [...validScores].sort(
      (a, b) => b.investoredgeScore - a.investoredgeScore,
    );

    return {
      geographyType: geoType,
      periodDate,
      comparison: validScores.map((score) => ({
        geographyId: score.geographyId,
        geographyName: score.geographyName,
        homereadyScore: score.homereadyScore,
        homereadyRank:
          homereadyRanked.findIndex(
            (s) => s.geographyId === score.geographyId,
          ) + 1,
        investoredgeScore: score.investoredgeScore,
        investoredgeRank:
          investoredgeRanked.findIndex(
            (s) => s.geographyId === score.geographyId,
          ) + 1,
        confidenceLevel: score.confidenceLevel,
      })),
      rankings: {
        homeready: homereadyRanked.map((s) => ({
          geographyId: s.geographyId,
          geographyName: s.geographyName,
          score: s.homereadyScore,
        })),
        investoredge: investoredgeRanked.map((s) => ({
          geographyId: s.geographyId,
          geographyName: s.geographyName,
          score: s.investoredgeScore,
        })),
      },
    };
  }

  /**
   * Calculate percentiles for a specific geography type and date
   *
   * POST /scoring/percentiles/:geographyType
   * Query params:
   *   - periodDate: Optional date (YYYY-MM-DD), defaults to latest
   */
  @Post('percentiles/:geographyType')
  async calculatePercentiles(
    @Param('geographyType') geographyType: string,
    @Query('periodDate') periodDate?: string,
  ) {
    const geoType = this.validateGeographyType(geographyType);

    let result;
    if (periodDate) {
      result = await this.percentileService.calculatePercentilesForDate(
        geoType,
        periodDate,
      );
    } else {
      result = await this.percentileService.calculateLatestPercentiles(geoType);
    }

    return {
      success: true,
      geographyType: geoType,
      periodDate,
      ...result,
    };
  }

  /**
   * Calculate percentiles for all dates (full recalculation)
   *
   * POST /scoring/percentiles-all/:geographyType
   */
  @Post('percentiles-all/:geographyType')
  async calculateAllPercentiles(@Param('geographyType') geographyType: string) {
    const geoType = this.validateGeographyType(geographyType);
    const result =
      await this.percentileService.calculateAllPercentiles(geoType);

    return {
      success: true,
      geographyType: geoType,
      ...result,
    };
  }

  /**
   * Full scoring pipeline: calculate percentiles then scores
   *
   * POST /scoring/run-pipeline/:geographyType
   * Query params:
   *   - periodDate: Optional date (YYYY-MM-DD), defaults to latest
   */
  @Post('run-pipeline/:geographyType')
  async runScoringPipeline(
    @Param('geographyType') geographyType: string,
    @Query('periodDate') periodDate?: string,
  ) {
    const geoType = this.validateGeographyType(geographyType);

    // Step 1: Calculate percentiles
    let percentileResult;
    if (periodDate) {
      percentileResult =
        await this.percentileService.calculatePercentilesForDate(
          geoType,
          periodDate,
        );
    } else {
      percentileResult =
        await this.percentileService.calculateLatestPercentiles(geoType);
    }

    // Step 2: Calculate scores
    const scoreResult = await this.scoringService.calculateAllScores(
      geoType,
      periodDate,
    );

    return {
      success: true,
      geographyType: geoType,
      periodDate,
      percentiles: percentileResult,
      scores: scoreResult,
    };
  }

  /**
   * Debug endpoint to diagnose scoring issues
   * GET /api/scoring/debug/:geographyType/:geographyId
   */
  @Get('debug/:geographyType/:geographyId')
  async debugScore(
    @Param('geographyType') geographyType: string,
    @Param('geographyId') geographyId: string,
  ) {
    const geoType = this.validateGeographyType(geographyType);
    const debug: Record<string, any> = {
      input: { geographyType: geoType, geographyId },
      checks: {},
    };

    // Check 1: Get latest date
    const latestDate = await this.scoringService.debugGetLatestDate(geoType);
    debug.checks.latestDate = latestDate;

    if (!latestDate) {
      debug.failureReason = 'No data found in zillow table for this geography type';
      return debug;
    }

    // Check 2: Get geography from geographies table
    const geography = await this.scoringService.debugGetGeography(geographyId, geoType);
    debug.checks.geography = geography ? { found: true, name: geography.name, zillow_region_id: geography.zillow_region_id } : null;

    if (!geography) {
      debug.failureReason = `Geography ${geographyId} not found in geographies table for type ${geoType}`;
      return debug;
    }

    // Check 3: Get metrics
    const metrics = await this.scoringService.debugGetMetrics(geography, geoType, latestDate);
    debug.checks.metrics = {
      count: Object.keys(metrics).length,
      keys: Object.keys(metrics).slice(0, 10),
    };

    if (Object.keys(metrics).length === 0) {
      debug.failureReason = 'No metrics found for this geography';
      return debug;
    }

    // Check 4: Get percentiles
    const percentiles = await this.scoringService.debugGetPercentiles(geoType, latestDate);
    debug.checks.percentiles = {
      count: Object.keys(percentiles).length,
      keys: Object.keys(percentiles).slice(0, 10),
    };

    debug.status = 'All checks passed - score should calculate';
    return debug;
  }

  private validateGeographyType(type: string): GeographyType {
    const validTypes: GeographyType[] = ['state', 'metro', 'county', 'zip'];
    const lowerType = type.toLowerCase() as GeographyType;

    if (!validTypes.includes(lowerType)) {
      throw new HttpException(
        `Invalid geography type: ${type}. Valid types: ${validTypes.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return lowerType;
  }

  private validateUserTier(tier?: string): UserTier {
    if (!tier) return 'free';
    const validTiers: UserTier[] = ['free', 'basic', 'pro', 'enterprise'];
    const lowerTier = tier.toLowerCase() as UserTier;
    return validTiers.includes(lowerTier) ? lowerTier : 'free';
  }

  /**
   * Build response with all three scores and access control
   */
  private buildAllScoresResponse(
    score: PropertyIQScore,
    userTier: UserTier,
    expanded: boolean,
  ): AllScoresResponseDto {
    const marketHealthAccess = getScoreAccess('market_health', userTier);
    const homereadyAccess = getScoreAccess('homeready', userTier);
    const investoredgeAccess = getScoreAccess('investoredge', userTier);

    return {
      geographyId: score.geographyId,
      geographyType: score.geographyType,
      geographyName: score.geographyName,
      stateCode: score.stateCode || undefined,
      periodDate: score.periodDate,
      userTier,

      marketHealth: this.buildScoreResponse(
        'market_health',
        score.marketHealthScore,
        score.marketHealthTrend,
        score.marketHealthTrendChange,
        score.periodDate,
        marketHealthAccess,
        expanded,
        score.marketHealthComponents ? this.buildComponentDetails(
          score.marketHealthComponents,
          MARKET_HEALTH_WEIGHTS,
        ) : [],
        this.buildConfidence(score),
        score.dataCompleteness,
        score.inheritedMetrics,
      ),

      homeready: homereadyAccess === 'full'
        ? this.buildScoreResponse(
            'homeready',
            score.homereadyScore,
            score.homereadyTrend,
            score.homereadyTrendChange,
            score.periodDate,
            homereadyAccess,
            expanded,
            this.buildComponentDetails(
              score.homereadyComponents,
              HOMEREADY_WEIGHTS,
            ),
            this.buildConfidence(score),
            score.dataCompleteness,
            score.inheritedMetrics,
          )
        : this.buildTeaserResponse(
            'homeready',
            score.homereadyScore,
            score.homereadyTrend,
            score.homereadyTrendChange,
            score.periodDate,
            score.homereadyComponents,
          ),

      investoredge: investoredgeAccess === 'full'
        ? this.buildScoreResponse(
            'investoredge',
            score.investoredgeScore,
            score.investoredgeTrend,
            score.investoredgeTrendChange,
            score.periodDate,
            investoredgeAccess,
            expanded,
            this.buildComponentDetails(
              score.investoredgeComponents,
              INVESTOREDGE_WEIGHTS,
            ),
            this.buildConfidence(score),
            score.dataCompleteness,
            score.inheritedMetrics,
          )
        : this.buildTeaserResponse(
            'investoredge',
            score.investoredgeScore,
            score.investoredgeTrend,
            score.investoredgeTrendChange,
            score.periodDate,
            score.investoredgeComponents,
          ),

      calculatedAt: score.calculatedAt,
      calculationVersion: score.calculationVersion,
    };
  }

  /**
   * Build a score badge or card response
   */
  private buildScoreResponse(
    type: ScoreType,
    scoreValue: number | null,
    trend: 'up' | 'down' | 'stable',
    trendChange: number,
    periodDate: string,
    access: 'full' | 'teaser',
    expanded: boolean,
    components: ComponentDetailDto[],
    confidence: ConfidenceDto,
    dataCompleteness: number,
    inheritedMetrics: Record<string, string>,
  ): ScoreBadgeResponseDto | ScoreCardResponseDto {
    const status = this.getScoreStatus(scoreValue, dataCompleteness);

    const badge: ScoreBadgeResponseDto = {
      type,
      label: getScoreLabel(type),
      score: scoreValue,
      trend,
      trendChange,
      access,
      status,
      statusMessage: status !== 'complete' ? this.getStatusMessage(status, dataCompleteness) : undefined,
      periodDate,
    };

    if (!expanded) {
      return badge;
    }

    // Return full card response
    const card: ScoreCardResponseDto = {
      ...badge,
      components,
      confidence,
      dataCompleteness,
      inheritedMetricsCount: Object.keys(inheritedMetrics).length,
      inheritedMetrics,
    };

    return card;
  }

  /**
   * Build a teaser response for locked scores
   */
  private buildTeaserResponse(
    type: ScoreType,
    scoreValue: number | null,
    trend: 'up' | 'down' | 'stable',
    trendChange: number,
    periodDate: string,
    components: Record<string, ComponentScore>,
  ): ScoreTeaserResponseDto {
    const lockedComponents: LockedComponentDto[] = Object.entries(components).map(
      ([name, component]) => ({
        name,
        label: getComponentLabel(name),
        weight: component.weight,
        blurredScore: '??',
      }),
    );

    return {
      type,
      label: getScoreLabel(type),
      score: null, // Hide actual score
      trend,
      trendChange: 0, // Hide trend change
      access: 'teaser',
      status: 'complete',
      periodDate,
      lockedComponents,
      upgradeCta: createUpgradeCta(type),
      teaserDescription: `Upgrade to Pro to unlock the ${getScoreLabel(type)} with detailed component breakdown and insights.`,
    };
  }

  /**
   * Build component details from component scores
   */
  private buildComponentDetails<T extends string>(
    components: Record<T, ComponentScore>,
    weights: Record<T, number>,
  ): ComponentDetailDto[] {
    return Object.entries(components).map(([name, component]) => {
      const comp = component as ComponentScore;
      return {
        name,
        label: getComponentLabel(name),
        weight: weights[name as T] || comp.weight,
        score: comp.score,
        weightedContribution: comp.weightedContribution,
        description: getComponentDescription(name),
        metrics: [], // Metrics would need to be populated from detailed data
        helpingFactors: comp.helpingFactors,
        hurtingFactors: comp.hurtingFactors,
      };
    });
  }

  /**
   * Build confidence information
   */
  private buildConfidence(score: PropertyIQScore): ConfidenceDto {
    const percentage = score.metricsTotal > 0
      ? Math.round((score.metricsAvailable / score.metricsTotal) * 100)
      : 0;

    return {
      level: score.confidenceLevel,
      percentage,
      metricsAvailable: score.metricsAvailable,
      metricsTotal: score.metricsTotal,
      freshnessInDays: score.dataFreshnessDays,
      warning: score.confidenceLevel === 'low'
        ? 'This score has limited confidence due to missing data'
        : undefined,
    };
  }

  /**
   * Determine score status based on value and completeness
   */
  private getScoreStatus(
    score: number | null,
    completeness: number,
  ): 'complete' | 'partial' | 'unavailable' {
    if (score === null) return 'unavailable';
    if (completeness < 50) return 'unavailable';
    if (completeness < 100) return 'partial';
    return 'complete';
  }

  /**
   * Get status message for partial/unavailable scores
   */
  private getStatusMessage(
    status: 'complete' | 'partial' | 'unavailable',
    completeness: number,
  ): string {
    switch (status) {
      case 'unavailable':
        return 'Insufficient data available for this geography';
      case 'partial':
        return `Score based on ${completeness.toFixed(0)}% of available data`;
      default:
        return '';
    }
  }
}
