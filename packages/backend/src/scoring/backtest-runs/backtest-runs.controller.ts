/**
 * Backtest Runs Controller
 *
 * REST API endpoints for managing automated backtest runs.
 *
 * Endpoints:
 * - GET /api/admin/backtest-runs - List recent backtest runs
 * - GET /api/admin/backtest-runs/:id - Get specific run details
 * - GET /api/admin/backtest-runs/:id/samples - Get sampling details for run
 * - POST /api/admin/backtest-runs/trigger - Manually trigger backtest run
 * - GET /api/admin/backtest-runs/confidence/summary - Get confidence summary
 * - GET /api/admin/backtest-runs/confidence/trend - Get confidence trend
 * - GET /api/admin/backtest-runs/statistics - Get run statistics
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

import {
  BacktestRunsService,
  ListBacktestRunsParams,
} from './backtest-runs.service';
import { TriggerBacktestDto } from './trigger-backtest.dto';

@Controller('api/admin/backtest-runs')
export class BacktestRunsController {
  private readonly logger = new Logger(BacktestRunsController.name);

  constructor(private readonly backtestRunsService: BacktestRunsService) {}

  /**
   * List recent backtest runs with optional filtering.
   *
   * Query params:
   * - limit: Number of results (default: 20)
   * - offset: Pagination offset (default: 0)
   * - status: Filter by status (healthy, review_needed, action_required)
   * - startDate: Filter by start date (ISO string)
   * - endDate: Filter by end date (ISO string)
   */
  @Get()
  async listRuns(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('status') status?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    try {
      const params: ListBacktestRunsParams = {
        limit: limit ? parseInt(limit, 10) : 20,
        offset: offset ? parseInt(offset, 10) : 0,
        status,
        startDate,
        endDate,
      };

      const result = await this.backtestRunsService.listRuns(params);

      return {
        success: true,
        data: result.runs,
        pagination: {
          total: result.total,
          limit: params.limit,
          offset: params.offset,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to list backtest runs: ${error}`);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to list backtest runs',
          message: error instanceof Error ? error.message : String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get a specific backtest run by ID.
   */
  @Get(':id')
  async getRun(@Param('id') id: string) {
    try {
      const run = await this.backtestRunsService.getRun(id);

      if (!run) {
        throw new HttpException(
          {
            success: false,
            error: 'Backtest run not found',
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        success: true,
        data: run,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to get backtest run: ${error}`);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to get backtest run',
          message: error instanceof Error ? error.message : String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get sampling details for a specific backtest run.
   */
  @Get(':id/samples')
  async getRunSamples(@Param('id') id: string) {
    try {
      const samples = await this.backtestRunsService.getRunSamples(id);

      return {
        success: true,
        data: samples,
      };
    } catch (error) {
      this.logger.error(`Failed to get backtest samples: ${error}`);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to get backtest samples',
          message: error instanceof Error ? error.message : String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Manually trigger a new backtest run.
   *
   * Body params:
   * - score_types: Array of score types to test
   * - horizons: Array of horizons to test
   * - county_sample: Sample size for counties
   * - zip_sample: Sample size for ZIPs
   * - random_seed: Random seed for reproducibility
   */
  @Post('trigger')
  async triggerBacktest(@Body() params: TriggerBacktestDto) {
    try {
      const result = await this.backtestRunsService.triggerBacktest(params);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Failed to trigger backtest: ${error}`);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to trigger backtest',
          message: error instanceof Error ? error.message : String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get the status of a backtest job.
   */
  @Get('job/:jobId/status')
  async getJobStatus(@Param('jobId') jobId: string) {
    try {
      const status = await this.backtestRunsService.getJobStatus(jobId);

      if (!status) {
        throw new HttpException(
          {
            success: false,
            error: 'Job not found',
          },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        success: true,
        data: status,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to get job status: ${error}`);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to get job status',
          message: error instanceof Error ? error.message : String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get confidence summary across all score/horizon/geography combinations.
   */
  @Get('confidence/summary')
  async getConfidenceSummary() {
    try {
      const summary = await this.backtestRunsService.getConfidenceSummary();

      return {
        success: true,
        data: summary,
      };
    } catch (error) {
      this.logger.error(`Failed to get confidence summary: ${error}`);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to get confidence summary',
          message: error instanceof Error ? error.message : String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get confidence trend over time for a specific combination.
   *
   * Query params:
   * - scoreType: Score type (market_health, homeready, investoredge)
   * - horizon: Horizon (6m, 1y, 3y, 5y)
   * - geographyType: Geography type (state, metro, county, zip)
   * - months: Number of months of history (default: 12)
   */
  @Get('confidence/trend')
  async getConfidenceTrend(
    @Query('scoreType') scoreType: string,
    @Query('horizon') horizon: string,
    @Query('geographyType') geographyType: string,
    @Query('months') months?: string,
  ) {
    if (!scoreType || !horizon || !geographyType) {
      throw new HttpException(
        {
          success: false,
          error: 'Missing required parameters: scoreType, horizon, geographyType',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const trend = await this.backtestRunsService.getConfidenceTrend(
        scoreType,
        horizon,
        geographyType,
        months ? parseInt(months, 10) : 12,
      );

      return {
        success: true,
        data: trend,
      };
    } catch (error) {
      this.logger.error(`Failed to get confidence trend: ${error}`);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to get confidence trend',
          message: error instanceof Error ? error.message : String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get run statistics for the dashboard.
   */
  @Get('statistics')
  async getStatistics() {
    try {
      const stats = await this.backtestRunsService.getRunStatistics();

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      this.logger.error(`Failed to get run statistics: ${error}`);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to get run statistics',
          message: error instanceof Error ? error.message : String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
