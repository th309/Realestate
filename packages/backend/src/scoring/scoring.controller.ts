/**
 * PropertyIQ Scoring Controller
 *
 * API endpoints for PropertyIQ score calculation and retrieval.
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { PercentileService } from './percentile.service';
import { GeographyType } from './scoring.types';

@Controller('scoring')
export class ScoringController {
  constructor(
    private readonly scoringService: ScoringService,
    private readonly percentileService: PercentileService,
  ) {}

  /**
   * Get PropertyIQ score for a specific geography
   *
   * GET /scoring/:geographyType/:geographyId
   * Query params:
   *   - periodDate: Optional date (YYYY-MM-DD), defaults to latest
   *   - recalculate: If true, forces recalculation instead of using cached score
   */
  @Get(':geographyType/:geographyId')
  async getScore(
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

    // Try to get cached score first
    const cachedScore = await this.scoringService.getScore(
      geographyId,
      geoType,
      periodDate,
    );
    if (cachedScore) {
      return cachedScore;
    }

    // If no cached score, calculate it
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
}
