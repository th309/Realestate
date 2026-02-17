/**
 * Features Controller
 *
 * Admin endpoints for feature management.
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { FeaturesService } from './features.service';

@Controller('api/admin/features')
export class FeaturesController {
  private readonly logger = new Logger(FeaturesController.name);

  constructor(private readonly featuresService: FeaturesService) {}

  /**
   * Get all feature definitions
   * GET /api/admin/features
   */
  @Get()
  async getAllFeatures() {
    this.logger.log('GET /admin/features');

    try {
      const features = await this.featuresService.getAllFeatures();
      return {
        success: true,
        data: features,
        count: features.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get features grouped by category
   * GET /api/admin/features/by-category
   */
  @Get('by-category')
  async getFeaturesByCategory() {
    this.logger.log('GET /admin/features/by-category');

    try {
      const grouped = await this.featuresService.getFeaturesByCategory();
      return {
        success: true,
        data: grouped,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get pricing summary for public pricing page
   * GET /api/admin/features/pricing-summary
   */
  @Get('pricing-summary')
  async getPricingSummary() {
    this.logger.log('GET /admin/features/pricing-summary');

    try {
      const summary = await this.featuresService.getPricingSummary();
      return {
        success: true,
        data: summary,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get full feature matrix
   * GET /api/admin/features/matrix
   */
  @Get('matrix')
  async getFeatureMatrix() {
    this.logger.log('GET /admin/features/matrix');

    try {
      const matrix = await this.featuresService.getFeatureMatrix();
      return {
        success: true,
        data: matrix,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update a tier feature value
   * PUT /api/admin/features/tier/:tierSlug/:featureSlug
   */
  @Put('tier/:tierSlug/:featureSlug')
  async updateTierFeature(
    @Param('tierSlug') tierSlug: string,
    @Param('featureSlug') featureSlug: string,
    @Body() body: { value: unknown },
  ) {
    this.logger.log(`PUT /admin/features/tier/${tierSlug}/${featureSlug}`);

    if (body.value === undefined) {
      throw new HttpException('value is required', HttpStatus.BAD_REQUEST);
    }

    try {
      await this.featuresService.updateTierFeature(tierSlug, featureSlug, body.value);
      return {
        success: true,
        updated: {
          tier: tierSlug,
          feature: featureSlug,
          value: body.value,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Bulk update tier features
   * PUT /api/admin/features/tier/:tierSlug
   */
  @Put('tier/:tierSlug')
  async bulkUpdateTierFeatures(
    @Param('tierSlug') tierSlug: string,
    @Body() body: { features: Record<string, unknown> },
  ) {
    this.logger.log(`PUT /admin/features/tier/${tierSlug} (bulk)`);

    if (!body.features || typeof body.features !== 'object') {
      throw new HttpException('features object is required', HttpStatus.BAD_REQUEST);
    }

    try {
      await this.featuresService.bulkUpdateTierFeatures(tierSlug, body.features);
      return {
        success: true,
        updated: Object.keys(body.features).length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create a new feature
   * POST /api/admin/features
   */
  @Post()
  async createFeature(
    @Body() body: {
      slug: string;
      name: string;
      description?: string;
      category: string;
      value_type: string;
      default_value: unknown;
    },
  ) {
    this.logger.log('POST /admin/features');

    if (!body.slug || !body.name || !body.category || !body.value_type) {
      throw new HttpException(
        'slug, name, category, and value_type are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const feature = await this.featuresService.createFeature(body);
      return {
        success: true,
        data: feature,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update a feature definition
   * PUT /api/admin/features/:slug
   */
  @Put(':slug')
  async updateFeature(
    @Param('slug') slug: string,
    @Body() body: Partial<{
      name: string;
      description: string;
      is_active: boolean;
    }>,
  ) {
    this.logger.log(`PUT /admin/features/${slug}`);

    try {
      const feature = await this.featuresService.updateFeature(slug, body);
      return {
        success: true,
        data: feature,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
