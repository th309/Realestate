/**
 * PropertyIQ Scoring — Market Discovery Endpoints
 *
 * Sibling `@Controller('api/scores')` holding the non-collision-sensitive market
 * discovery routes (top / search / distribution). Split out of ScoringController
 * verbatim for file-size compliance. All routes here are single-segment literals
 * (`top`, `search`, `distribution`) so they never collide with the catch-all
 * `:geography/:locationId` that lives on ScoringController.
 */

import {
  Controller,
  Get,
  Query,
  Header,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ScoringService } from './scoring.service';
import { normalizeStateToCode } from '../common/geo';
import {
  validateGeography,
  validateScoreType,
} from './scoring-request.helpers';
import { ScoreDistribution } from './scoring-queries-distribution';

@ApiTags('scores')
@Controller('api/scores')
export class ScoringMarketsController {
  constructor(private readonly scoringService: ScoringService) {}

  /**
   * Get top markets by score
   *
   * GET /api/scores/top?geography=metro&score_type=homeready&limit=10
   */
  @Get('top')
  @Header('Cache-Control', 'public, max-age=21600')
  @ApiOperation({ summary: 'Get top markets by score' })
  @ApiQuery({
    name: 'geography',
    required: true,
    enum: ['metro', 'county', 'zip'],
  })
  @ApiQuery({
    name: 'score_type',
    required: true,
    enum: ['propertyiq'],
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of results (default 10, max 100)',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'Score date (YYYY-MM-DD), defaults to latest',
  })
  @ApiQuery({
    name: 'state',
    required: false,
    description: 'Two-letter state code (e.g. IL) to filter within',
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    description: 'Sort order: "asc" or "desc" (default "desc")',
    enum: ['asc', 'desc'],
  })
  async getTopMarkets(
    @Query('geography') geography: string,
    @Query('score_type') scoreType: string,
    @Query('limit') limitStr?: string,
    @Query('date') date?: string,
    @Query('state') state?: string,
    @Query('sort') sort?: string,
  ): Promise<
    {
      location_id: string;
      location_name: string;
      score: number;
      grade: string;
    }[]
  > {
    if (!geography) {
      throw new HttpException(
        'geography query parameter is required',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!scoreType) {
      throw new HttpException(
        'score_type query parameter is required',
        HttpStatus.BAD_REQUEST,
      );
    }

    const geoLevel = validateGeography(geography);
    const validScoreType = validateScoreType(scoreType);
    const limit = Math.min(Math.max(parseInt(limitStr || '10', 10), 1), 100);

    // Normalize state to 2-letter code if provided
    const normalizedState = state
      ? normalizeStateToCode(state.trim())
      : undefined;

    if (sort !== undefined && sort !== 'asc' && sort !== 'desc') {
      throw new HttpException(
        'Invalid sort value. Must be "asc" or "desc".',
        HttpStatus.BAD_REQUEST,
      );
    }

    const ascending = sort === 'asc';
    return this.scoringService.getTopMarkets(
      geoLevel,
      validScoreType,
      limit,
      date,
      normalizedState,
      ascending,
    );
  }

  /**
   * Search markets by name
   *
   * GET /api/scores/search?q=austin&geography=zip
   */
  @Get('search')
  @Header('Cache-Control', 'public, max-age=21600')
  @ApiOperation({ summary: 'Search markets by name' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({
    name: 'geography',
    required: false,
    enum: ['metro', 'county', 'zip'],
    description: 'Filter by geography type',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of results (default 20, max 100)',
  })
  async searchMarkets(
    @Query('q') query: string,
    @Query('geography') geography?: string,
    @Query('limit') limitStr?: string,
  ): Promise<
    { location_id: string; location_name: string; geography: string }[]
  > {
    if (!query || query.trim().length < 2) {
      throw new HttpException(
        'q query parameter must be at least 2 characters',
        HttpStatus.BAD_REQUEST,
      );
    }

    const geoLevel = geography ? validateGeography(geography) : undefined;
    const limit = Math.min(Math.max(parseInt(limitStr || '20', 10), 1), 100);

    return this.scoringService.searchMarkets(query.trim(), geoLevel, limit);
  }

  /**
   * GET /api/scores/distribution?geography=metro&score_type=propertyiq
   *
   * Momentum-band distribution across all scored markets at the latest
   * period. Public; powers the /forecast national hub.
   */
  @Get('distribution')
  @Header('Cache-Control', 'public, max-age=21600')
  @ApiOperation({ summary: 'Get score distribution by momentum band' })
  @ApiQuery({
    name: 'geography',
    required: true,
    enum: ['metro', 'county', 'zip'],
  })
  @ApiQuery({
    name: 'score_type',
    required: false,
    description: 'Defaults to propertyiq',
  })
  async getScoreDistribution(
    @Query('geography') geography: string,
    @Query('score_type') scoreType: string,
  ): Promise<ScoreDistribution> {
    if (!geography) {
      throw new HttpException(
        'geography query parameter is required',
        HttpStatus.BAD_REQUEST,
      );
    }
    const geoLevel = validateGeography(geography);
    const validScoreType = validateScoreType(scoreType || 'propertyiq');
    return this.scoringService.getScoreDistribution(geoLevel, validScoreType);
  }
}
