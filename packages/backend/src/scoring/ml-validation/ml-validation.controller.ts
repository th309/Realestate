/**
 * ML Validation Controller
 *
 * API endpoints for managing ML validation jobs.
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { MLValidationService, MLValidationConfig } from './ml-validation.service';

interface RunMLValidationDto {
  scoreType: 'homeready' | 'investoredge' | 'market_health';
  geographyType: 'metro' | 'county' | 'zip';
  horizon: '6m' | '1y' | '3y' | '5y';
  trainPeriodStart: string;
  trainPeriodEnd: string;
  testPeriodStart: string;
  testPeriodEnd: string;
  mlPreset?: 'medium_quality' | 'best_quality' | 'high_quality';
  timeLimitSeconds?: number;
}

interface ApplySuggestionsDto {
  applyWeights: boolean;
  applyMetrics: boolean;
}

@Controller('api/admin/ml-validation')
export class MLValidationController {
  private readonly logger = new Logger(MLValidationController.name);

  constructor(private readonly mlValidationService: MLValidationService) {}

  /**
   * POST /api/admin/ml-validation/run
   * Queue a new ML validation job.
   */
  @Post('run')
  async runMLValidation(@Body() dto: RunMLValidationDto) {
    this.logger.log(`Running ML validation for ${dto.scoreType} @ ${dto.geographyType}`);

    const config: MLValidationConfig = {
      scoreType: dto.scoreType,
      geographyType: dto.geographyType,
      horizon: dto.horizon,
      trainPeriodStart: dto.trainPeriodStart,
      trainPeriodEnd: dto.trainPeriodEnd,
      testPeriodStart: dto.testPeriodStart,
      testPeriodEnd: dto.testPeriodEnd,
      mlPreset: dto.mlPreset || 'best_quality',
      timeLimitSeconds: dto.timeLimitSeconds || 300,
    };

    try {
      const result = await this.mlValidationService.queueMLValidationJob(config);
      return result;
    } catch (error) {
      this.logger.error(`Failed to queue ML validation: ${error}`);
      throw new HttpException(
        `Failed to queue ML validation: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/admin/ml-validation/status/:jobId
   * Get the status of a running ML validation job.
   */
  @Get('status/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    const status = await this.mlValidationService.getJobStatus(jobId);

    if (!status) {
      throw new HttpException('Job not found', HttpStatus.NOT_FOUND);
    }

    return status;
  }

  /**
   * GET /api/admin/ml-validation/results
   * List previous ML validation results.
   */
  @Get('results')
  async listValidations(
    @Query('scoreType') scoreType?: string,
    @Query('geographyType') geographyType?: string,
    @Query('horizon') horizon?: string,
    @Query('limit') limit?: string,
  ) {
    const validations = await this.mlValidationService.listValidations({
      scoreType,
      geographyType,
      horizon,
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    return { validations };
  }

  /**
   * GET /api/admin/ml-validation/:id
   * Get a specific ML validation result.
   */
  @Get(':id')
  async getValidation(@Param('id') id: string) {
    const validation = await this.mlValidationService.getValidation(id);

    if (!validation) {
      throw new HttpException('Validation not found', HttpStatus.NOT_FOUND);
    }

    return validation;
  }

  /**
   * POST /api/admin/ml-validation/apply-suggestions/:id
   * Apply ML suggestions to create a draft formula version.
   */
  @Post('apply-suggestions/:id')
  async applySuggestions(
    @Param('id') id: string,
    @Body() dto: ApplySuggestionsDto,
  ) {
    try {
      const result = await this.mlValidationService.applySuggestions(id, {
        applyWeights: dto.applyWeights,
        applyMetrics: dto.applyMetrics,
      });
      return result;
    } catch (error) {
      this.logger.error(`Failed to apply suggestions: ${error}`);
      throw new HttpException(
        `Failed to apply suggestions: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
