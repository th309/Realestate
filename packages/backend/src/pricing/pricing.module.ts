/**
 * Pricing Module
 *
 * Public-facing pricing endpoints (no auth required).
 * Delegates to FeaturesService for tier/feature data.
 */

import { Module } from '@nestjs/common';
import { PricingController } from './pricing.controller';
import { FeaturesModule } from '../admin/features/features.module';
import { TrialModule } from '../admin/trial/trial.module';

@Module({
  imports: [FeaturesModule, TrialModule],
  controllers: [PricingController],
})
export class PricingModule {}
