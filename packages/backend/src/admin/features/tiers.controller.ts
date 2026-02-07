/**
 * Tiers Controller
 *
 * Admin endpoints for tier management.
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { TiersService, CreateTierDto, UpdateTierDto } from './tiers.service';

@Controller('api/admin/tiers')
export class TiersController {
  private readonly logger = new Logger(TiersController.name);

  constructor(private readonly tiersService: TiersService) {}

  /**
   * Get all tiers
   * GET /api/admin/tiers?active=true
   */
  @Get()
  async getAll(@Query('active') active?: string) {
    this.logger.log('GET /admin/tiers');

    try {
      const tiers = active === 'true'
        ? await this.tiersService.getActive()
        : await this.tiersService.getAll();

      return {
        success: true,
        data: tiers,
        count: tiers.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get tier by slug
   * GET /api/admin/tiers/:slug
   */
  @Get(':slug')
  async getBySlug(@Param('slug') slug: string) {
    this.logger.log(`GET /admin/tiers/${slug}`);

    try {
      const tier = await this.tiersService.getBySlug(slug);
      if (!tier) {
        return {
          success: false,
          error: 'Tier not found',
        };
      }
      return {
        success: true,
        data: tier,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get pricing history
   * GET /api/admin/tiers/:slug/pricing-history
   */
  @Get(':slug/pricing-history')
  async getPricingHistory(@Param('slug') slug: string) {
    this.logger.log(`GET /admin/tiers/${slug}/pricing-history`);

    try {
      const history = await this.tiersService.getPricingHistory(slug);
      return {
        success: true,
        data: history,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Create a new tier
   * POST /api/admin/tiers
   */
  @Post()
  async create(@Body() body: CreateTierDto) {
    this.logger.log('POST /admin/tiers');

    if (!body.slug || !body.name) {
      throw new HttpException(
        'slug and name are required',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const tier = await this.tiersService.create(body);
      return {
        success: true,
        data: tier,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update a tier
   * PUT /api/admin/tiers/:slug
   */
  @Put(':slug')
  async update(@Param('slug') slug: string, @Body() body: UpdateTierDto) {
    this.logger.log(`PUT /admin/tiers/${slug}`);

    try {
      const tier = await this.tiersService.update(slug, body);
      return {
        success: true,
        data: tier,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Set default tier
   * PUT /api/admin/tiers/:slug/default
   */
  @Put(':slug/default')
  async setDefault(@Param('slug') slug: string) {
    this.logger.log(`PUT /admin/tiers/${slug}/default`);

    try {
      await this.tiersService.setDefault(slug);
      return {
        success: true,
        defaultTier: slug,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
