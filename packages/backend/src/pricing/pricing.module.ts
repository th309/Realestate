/**
 * Pricing Module
 *
 * Public-facing pricing endpoints (no auth required).
 * Delegates to FeaturesService for tier/feature data.
 */

import { Module } from '@nestjs/common';
import { PricingController } from './pricing.controller';
import { FeaturesModule } from '../admin/features/features.module';

@Module({
  imports: [FeaturesModule],
  controllers: [PricingController],
})
export class PricingModule {}
