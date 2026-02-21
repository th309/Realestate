/**
 * Public Pricing Controller
 *
 * Unauthenticated endpoint for the /pricing page.
 * Returns tier info + feature lists for display.
 */

import { Controller, Get, Logger } from '@nestjs/common';
import { FeaturesService } from '../admin/features/features.service';

@Controller('api/pricing')
export class PricingController {
  private readonly logger = new Logger(PricingController.name);

  constructor(private readonly featuresService: FeaturesService) {}

  /**
   * GET /api/pricing/tiers
   * Public -- no auth guard. Returns tiers with prices and feature bullets.
   */
  @Get('tiers')
  async getTiers() {
    this.logger.log('GET /api/pricing/tiers');

    try {
      const summary = await this.featuresService.getPricingSummary();
      return { success: true, data: summary };
    } catch (error) {
      this.logger.error(`Failed to fetch pricing tiers: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}
