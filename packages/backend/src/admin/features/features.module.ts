/**
 * Features Admin Module
 *
 * Admin endpoints for managing tiers, features, user overrides, and grandfathering.
 */

import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../supabase/supabase.module';
import { BillingModule } from '../../billing/billing.module';
import { FeaturesService } from './features.service';
import { FeaturesController } from './features.controller';
import { TiersService } from './tiers.service';
import { TiersController } from './tiers.controller';
import { UserFeaturesService } from './user-features.service';
import { UserFeaturesController } from './user-features.controller';
import { GrandfatheringService } from './grandfathering.service';
import { GrandfatheringController } from './grandfathering.controller';
import { TierPricingController } from './tier-pricing.controller';

@Module({
  imports: [SupabaseModule, BillingModule],
  providers: [FeaturesService, TiersService, UserFeaturesService, GrandfatheringService],
  controllers: [FeaturesController, TiersController, UserFeaturesController, GrandfatheringController, TierPricingController],
  exports: [FeaturesService, TiersService, UserFeaturesService, GrandfatheringService],
})
export class FeaturesModule {}
