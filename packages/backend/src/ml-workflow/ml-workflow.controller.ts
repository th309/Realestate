/**
 * ML Workflow Controller
 *
 * REST API endpoints for managing PropertyIQ ML workflow via the
 * PropertyIQ Analytics microservice.
 *
 * Endpoints:
 * - GET  /api/admin/ml-workflow/status - Get status of all workflow steps
 * - GET  /api/admin/ml-workflow/health - Check analytics service health
 * - POST /api/admin/ml-workflow/run/:stepId - Run a specific workflow step
 * - GET  /api/admin/ml-workflow/job/:jobId - Get job status
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { MLWorkflowService } from './ml-workflow.service';

@Controller('api/admin/ml-workflow')
export class MLWorkflowController {
  private readonly logger = new Logger(MLWorkflowController.name);

  constructor(private readonly mlWorkflowService: MLWorkflowService) {}

  /**
   * Get status of all workflow steps.
   */
  @Get('status')
  async getWorkflowStatus() {
    try {
      const steps = await this.mlWorkflowService.getWorkflowStatus();

      return {
        success: true,
        data: {
          steps,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get workflow status: ${error}`);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to get workflow status',
          message: error instanceof Error ? error.message : String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Check analytics service health.
   */
  @Get('health')
  async checkAnalyticsHealth() {
    try {
      const health = await this.mlWorkflowService.checkAnalyticsHealth();

      return {
        success: true,
        data: health,
      };
    } catch (error) {
      this.logger.error(`Failed to check analytics health: ${error}`);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to check analytics service health',
          message: error instanceof Error ? error.message : String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Run a specific workflow step.
   */
  @Post('run/:stepId')
  async runStep(
    @Param('stepId') stepId: string,
    @Body() payload?: Record<string, unknown>,
  ) {
    try {
      const result = await this.mlWorkflowService.runStep(stepId, payload);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`Failed to run step ${stepId}: ${error}`);
      throw new HttpException(
        {
          success: false,
          error: `Failed to run step ${stepId}`,
          message: error instanceof Error ? error.message : String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get status of a specific job.
   */
  @Get('job/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    try {
      const job = await this.mlWorkflowService.getJobStatus(jobId);

      if (!job) {
        throw new HttpException(
          {
            success: false,
            error: 'Job not found',
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // Map DB status to UI status
      const uiStatus = job.status === 'failed' ? 'error' : job.status;

      return {
        success: true,
        data: {
          status: uiStatus,
          progress: job.progress,
          error: job.error,
          result: job.result,
          completedAt: job.completed_at,
        },
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
   * Get real-time export progress from analytics service.
   */
  @Get('export-progress')
  async getExportProgress() {
    try {
      const progress = await this.mlWorkflowService.getExportProgress();
      return {
        success: true,
        data: progress,
      };
    } catch (error) {
      this.logger.error(`Failed to get export progress: ${error}`);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to get export progress',
          message: error instanceof Error ? error.message : String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get cache status from analytics service.
   */
  @Get('cache-status')
  async getCacheStatus() {
    try {
      const status = await this.mlWorkflowService.getCacheStatus();
      return {
        success: true,
        data: status,
      };
    } catch (error) {
      this.logger.error(`Failed to get cache status: ${error}`);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to get cache status',
          message: error instanceof Error ? error.message : String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
