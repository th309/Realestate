import { Module, forwardRef } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { RedisModule } from '../redis/redis.module';
import { FeaturesModule } from '../admin/features/features.module';
import { OrgBillingModule } from '../org-billing/org-billing.module';
import { UserAnalyticsModule } from '../user-analytics/user-analytics.module';
import { EntitlementsService } from './entitlements.service';
import { EnterpriseGraceService } from './enterprise-grace.service';
import { TrialFeatureUsageEmitterService } from './trial-feature-usage-emitter.service';
import { McpEntitlementsInvalidator } from './mcp-entitlements-invalidator.service';
import { TierResolverService } from './tier-resolver.service';
import { EntitlementsController } from './entitlements.controller';

@Module({
  imports: [
    SupabaseModule,
    RedisModule,
    FeaturesModule,
    forwardRef(() => OrgBillingModule),
    UserAnalyticsModule,
  ],
  providers: [
    EntitlementsService,
    TierResolverService,
    EnterpriseGraceService,
    TrialFeatureUsageEmitterService,
    McpEntitlementsInvalidator,
  ],
  controllers: [EntitlementsController],
  exports: [
    EntitlementsService,
    EnterpriseGraceService,
    McpEntitlementsInvalidator,
  ],
})
export class EntitlementsModule {}
