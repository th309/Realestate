/**
 * Public Pricing Controller
 *
 * Unauthenticated endpoint for the /pricing page.
 * Returns tier info + feature lists for display.
 */

import { Controller, Get, Logger } from '@nestjs/common';
import { FeaturesService } from '../admin/features/features.service';
import { TrialService } from '../admin/trial/trial.service';

@Controller('api/pricing')
export class PricingController {
  private readonly logger = new Logger(PricingController.name);

  constructor(
    private readonly featuresService: FeaturesService,
    private readonly trialService: TrialService,
  ) {}

  /**
   * GET /api/pricing/tiers
   * Public -- no auth guard. Returns tiers with prices and feature bullets.
   */
  @Get('tiers')
  async getTiers() {
    this.logger.log('GET /api/pricing/tiers');

    try {
      const [summary, trialConfig] = await Promise.all([
        this.featuresService.getPricingSummary(),
        this.trialService.getConfig().catch((err) => {
          this.logger.warn(`Failed to fetch trial config: ${err.message}`);
          return null;
        }),
      ]);

      return {
        success: true,
        data: {
          ...summary,
          trial: trialConfig
            ? {
                is_enabled: trialConfig.is_enabled,
                duration_days: trialConfig.duration_days,
                trial_tier: trialConfig.trial_tier,
              }
            : null,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to fetch pricing tiers: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}
