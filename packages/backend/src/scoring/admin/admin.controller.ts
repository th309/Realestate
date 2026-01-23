/**
 * Admin Controller for Formula Versions and A/B Tests
 *
 * REST API endpoints for managing scoring formula versions and A/B tests.
 *
 * Formula Version Endpoints:
 * - GET /api/admin/formula-versions?scoreType={scoreType} - List all versions
 * - GET /api/admin/formula-versions/:version?scoreType={scoreType} - Get specific version
 * - POST /api/admin/formula-versions - Create new version
 * - POST /api/admin/formula-versions/:version/activate - Activate version
 * - POST /api/admin/formula-versions/:version/set-default - Set as default
 * - POST /api/admin/formula-versions/:version/rollback - Rollback to version
 *
 * A/B Test Endpoints:
 * - GET /api/admin/ab-tests?scoreType={scoreType} - List all tests
 * - GET /api/admin/ab-tests/:id - Get specific test
 * - POST /api/admin/ab-tests - Create new test
 * - POST /api/admin/ab-tests/:id/start - Start test
 * - POST /api/admin/ab-tests/:id/pause - Pause test
 * - POST /api/admin/ab-tests/:id/resume - Resume test
 * - POST /api/admin/ab-tests/:id/complete - Complete test
 * - POST /api/admin/ab-tests/:id/rollback - Rollback test
 * - GET /api/admin/ab-tests/:id/analysis - Get test analysis
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
  FormulaVersionService,
  CreateVersionInput,
} from '../versioning/formula-version.service';
import {
  ABTestService,
  CreateABTestInput,
} from '../versioning/ab-test.service';
import type { ScoreType } from '../scoring.types';

// DTOs
interface CreateFormulaVersionDto {
  scoreType: string;
  formulaConfig: {
    components: Record<
      string,
      {
        weight: number;
        metrics: string[];
        normalization?: Record<string, unknown>;
      }
    >;
  };
  description?: string;
  parentVersion?: string;
  changeNotes?: string;
}

interface CreateABTestDto {
  name: string;
  scoreType: string;
  controlVersion: string;
  treatmentVersion: string;
  trafficPercentage?: number;
  hypothesis?: string;
  minSampleSize?: number;
  minDurationDays?: number;
}

interface CompleteTestDto {
  adoptTreatment: boolean;
}

@Controller('api/admin')
export class AdminController {
  private readonly logger = new Logger(AdminController.name);

  constructor(
    private readonly formulaVersionService: FormulaVersionService,
    private readonly abTestService: ABTestService,
  ) {}

  // ========================================================================
  // Formula Version Endpoints
  // ========================================================================

  /**
   * List all formula versions for a score type.
   */
  @Get('formula-versions')
  async listFormulaVersions(@Query('scoreType') scoreType: string) {
    if (!scoreType) {
      throw new HttpException(
        { success: false, error: 'scoreType query parameter is required' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const versions = await this.formulaVersionService.getAllVersions(
        scoreType as ScoreType,
      );

      return {
        success: true,
        versions,
      };
    } catch (error) {
      this.logger.error(`Failed to list formula versions: ${error}`);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to list formula versions',
          message: error instanceof Error ? error.message : String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get a specific formula version.
   */
  @Get('formula-versions/:version')
  async getFormulaVersion(
    @Param('version') version: string,
    @Query('scoreType') scoreType: string,
  ) {
    if (!scoreType) {
      throw new HttpException(
        { success: false, error: 'scoreType query parameter is required' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const formulaVersion = await this.formulaVersionService.getVersion(
        version,
        scoreType as ScoreType,
      );

      if (!formulaVersion) {
        throw new HttpException(
          { success: false, error: 'Formula version not found' },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        success: true,
        version: formulaVersion,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to get formula version: ${error}`);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to get formula version',
          message: error instanceof Error ? error.message : String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Create a new formula version.
   */
  @Post('formula-versions')
  async createFormulaVersion(@Body() dto: CreateFormulaVersionDto) {
    if (!dto.scoreType || !dto.formulaConfig) {
      throw new HttpException(
        {
          success: false,
          error: 'scoreType and formulaConfig are required',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const input: CreateVersionInput = {
        scoreType: dto.scoreType as ScoreType,
        formulaConfig: dto.formulaConfig,
        description: dto.description,
        parentVersion: dto.parentVersion,
        changeNotes: dto.changeNotes,
      };

      const newVersion = await this.formulaVersionService.createVersion(input);

      this.logger.log(
        `Created formula version ${newVersion.version} for ${dto.scoreType}`,
      );

      return {
        success: true,
        version: newVersion.version,
        data: newVersion,
      };
    } catch (error) {
      this.logger.error(`Failed to create formula version: ${error}`);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to create formula version',
          message: error instanceof Error ? error.message : String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Activate a formula version.
   */
  @Post('formula-versions/:version/activate')
  async activateVersion(
    @Param('version') version: string,
    @Query('scoreType') scoreType: string,
  ) {
    if (!scoreType) {
      throw new HttpException(
        { success: false, error: 'scoreType query parameter is required' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      await this.formulaVersionService.activateVersion(
        version,
        scoreType as ScoreType,
      );

      this.logger.log(`Activated formula version ${version} for ${scoreType}`);

      return {
        success: true,
        message: `Version ${version} activated for ${scoreType}`,
      };
    } catch (error) {
      this.logger.error(`Failed to activate formula version: ${error}`);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to activate formula version',
          message: error instanceof Error ? error.message : String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Set a formula version as default.
   */
  @Post('formula-versions/:version/set-default')
  async setDefaultVersion(
    @Param('version') version: string,
    @Query('scoreType') scoreType: string,
  ) {
    if (!scoreType) {
      throw new HttpException(
        { success: false, error: 'scoreType query parameter is required' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      await this.formulaVersionService.setDefaultVersion(
        version,
        scoreType as ScoreType,
      );

      this.logger.log(
        `Set formula version ${version} as default for ${scoreType}`,
      );

      return {
        success: true,
        message: `Version ${version} set as default for ${scoreType}`,
      };
    } catch (error) {
      this.logger.error(`Failed to set default version: ${error}`);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to set default version',
          message: error instanceof Error ? error.message : String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Rollback to a formula version.
   */
  @Post('formula-versions/:version/rollback')
  async rollbackVersion(
    @Param('version') version: string,
    @Query('scoreType') scoreType: string,
  ) {
    if (!scoreType) {
      throw new HttpException(
        { success: false, error: 'scoreType query parameter is required' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      await this.formulaVersionService.rollback(
        version,
        scoreType as ScoreType,
      );

      this.logger.log(`Rolled back to formula version ${version} for ${scoreType}`);

      return {
        success: true,
        message: `Rolled back to version ${version} for ${scoreType}`,
      };
    } catch (error) {
      this.logger.error(`Failed to rollback version: ${error}`);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to rollback version',
          message: error instanceof Error ? error.message : String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ========================================================================
  // A/B Test Endpoints
  // ========================================================================

  /**
   * List all A/B tests for a score type.
   */
  @Get('ab-tests')
  async listABTests(@Query('scoreType') scoreType: string) {
    if (!scoreType) {
      throw new HttpException(
        { success: false, error: 'scoreType query parameter is required' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const tests = await this.abTestService.getTestsForScoreType(
        scoreType as ScoreType,
      );

      return {
        success: true,
        tests,
      };
    } catch (error) {
      this.logger.error(`Failed to list A/B tests: ${error}`);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to list A/B tests',
          message: error instanceof Error ? error.message : String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get a specific A/B test.
   */
  @Get('ab-tests/:id')
  async getABTest(@Param('id') id: string) {
    try {
      const test = await this.abTestService.getTest(id);

      if (!test) {
        throw new HttpException(
          { success: false, error: 'A/B test not found' },
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        success: true,
        test,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Failed to get A/B test: ${error}`);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to get A/B test',
          message: error instanceof Error ? error.message : String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Create a new A/B test.
   */
  @Post('ab-tests')
  async createABTest(@Body() dto: CreateABTestDto) {
    if (!dto.name || !dto.scoreType || !dto.controlVersion || !dto.treatmentVersion) {
      throw new HttpException(
        {
          success: false,
          error: 'name, scoreType, controlVersion, and treatmentVersion are required',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const input: CreateABTestInput = {
        name: dto.name,
        scoreType: dto.scoreType as ScoreType,
        controlVersion: dto.controlVersion,
        treatmentVersion: dto.treatmentVersion,
        trafficPercentage: dto.trafficPercentage,
        hypothesis: dto.hypothesis,
        minSampleSize: dto.minSampleSize,
        minDurationDays: dto.minDurationDays,
      };

      const test = await this.abTestService.createTest(input);

      this.logger.log(`Created A/B test ${test.id}: ${dto.name}`);

      return {
        success: true,
        test,
      };
    } catch (error) {
      this.logger.error(`Failed to create A/B test: ${error}`);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to create A/B test',
          message: error instanceof Error ? error.message : String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Start an A/B test.
   */
  @Post('ab-tests/:id/start')
  async startABTest(@Param('id') id: string) {
    try {
      await this.abTestService.startTest(id);

      this.logger.log(`Started A/B test ${id}`);

      return {
        success: true,
        message: `A/B test ${id} started`,
      };
    } catch (error) {
      this.logger.error(`Failed to start A/B test: ${error}`);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to start A/B test',
          message: error instanceof Error ? error.message : String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Pause an A/B test.
   */
  @Post('ab-tests/:id/pause')
  async pauseABTest(@Param('id') id: string) {
    try {
      await this.abTestService.pauseTest(id);

      this.logger.log(`Paused A/B test ${id}`);

      return {
        success: true,
        message: `A/B test ${id} paused`,
      };
    } catch (error) {
      this.logger.error(`Failed to pause A/B test: ${error}`);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to pause A/B test',
          message: error instanceof Error ? error.message : String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Resume an A/B test.
   */
  @Post('ab-tests/:id/resume')
  async resumeABTest(@Param('id') id: string) {
    try {
      await this.abTestService.resumeTest(id);

      this.logger.log(`Resumed A/B test ${id}`);

      return {
        success: true,
        message: `A/B test ${id} resumed`,
      };
    } catch (error) {
      this.logger.error(`Failed to resume A/B test: ${error}`);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to resume A/B test',
          message: error instanceof Error ? error.message : String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Complete an A/B test.
   */
  @Post('ab-tests/:id/complete')
  async completeABTest(
    @Param('id') id: string,
    @Body() dto: CompleteTestDto,
  ) {
    try {
      await this.abTestService.completeTest(id, dto.adoptTreatment ?? false);

      this.logger.log(
        `Completed A/B test ${id}, adoptTreatment=${dto.adoptTreatment}`,
      );

      return {
        success: true,
        message: `A/B test ${id} completed`,
        adoptedTreatment: dto.adoptTreatment ?? false,
      };
    } catch (error) {
      this.logger.error(`Failed to complete A/B test: ${error}`);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to complete A/B test',
          message: error instanceof Error ? error.message : String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Rollback an A/B test.
   */
  @Post('ab-tests/:id/rollback')
  async rollbackABTest(@Param('id') id: string) {
    try {
      await this.abTestService.rollbackTest(id);

      this.logger.log(`Rolled back A/B test ${id}`);

      return {
        success: true,
        message: `A/B test ${id} rolled back to control`,
      };
    } catch (error) {
      this.logger.error(`Failed to rollback A/B test: ${error}`);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to rollback A/B test',
          message: error instanceof Error ? error.message : String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get analysis for an A/B test.
   */
  @Get('ab-tests/:id/analysis')
  async getABTestAnalysis(@Param('id') id: string) {
    try {
      const analysis = await this.abTestService.analyzeTest(id);

      return {
        success: true,
        analysis,
      };
    } catch (error) {
      this.logger.error(`Failed to get A/B test analysis: ${error}`);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to get A/B test analysis',
          message: error instanceof Error ? error.message : String(error),
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
