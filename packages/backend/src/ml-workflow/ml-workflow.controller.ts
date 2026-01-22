/**
 * ML Workflow Controller
 *
 * REST API endpoints for managing PropertyIQ ML workflow.
 *
 * Endpoints:
 * - GET  /api/admin/ml-workflow/status - Get status of all workflow steps
 * - POST /api/admin/ml-workflow/run/:stepId - Run a specific workflow step
 * - GET  /api/admin/ml-workflow/job/:jobId - Get job status
 * - GET  /api/admin/ml-workflow/outputs/:stepId - List output files for a step
 * - GET  /api/admin/ml-workflow/outputs/:stepId/:filename - Download/view output file
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Res,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
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
   * Run a specific workflow step.
   */
  @Post('run/:stepId')
  async runStep(@Param('stepId') stepId: string) {
    try {
      const result = await this.mlWorkflowService.runStep(stepId);

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
   * List output files for a step.
   */
  @Get('outputs/:stepId')
  async getStepOutputs(@Param('stepId') stepId: string) {
    try {
      const outputs = await this.mlWorkflowService.getStepOutputFiles(stepId);

      return {
        success: true,
        data: outputs,
      };
    } catch (error) {
      this.logger.error(`Failed to get outputs for ${stepId}: ${error}`);
      throw new HttpException(
        {
          success: false,
          error: `Failed to get outputs for ${stepId}`,
          message: error instanceof Error ? error.message : String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Download or view a specific output file.
   */
  @Get('outputs/:stepId/:filename')
  async getOutputFile(
    @Param('stepId') stepId: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    try {
      const file = this.mlWorkflowService.getOutputFile(stepId, filename);

      if (!file) {
        throw new HttpException(
          {
            success: false,
            error: 'File not found',
          },
          HttpStatus.NOT_FOUND,
        );
      }

      res.setHeader('Content-Type', file.contentType);

      // For HTML files, allow viewing in browser
      if (file.contentType === 'text/html') {
        res.setHeader('Content-Disposition', 'inline');
      } else {
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${filename}"`,
        );
      }

      res.send(file.content);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to get output file: ${error}`);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to get output file',
          message: error instanceof Error ? error.message : String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
