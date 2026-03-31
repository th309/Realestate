import { Module, forwardRef } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { RedisModule } from '../redis/redis.module';
import { FeaturesModule } from '../admin/features/features.module';
import { OrgBillingModule } from '../org-billing/org-billing.module';
import { EntitlementsService } from './entitlements.service';
import { EnterpriseGraceService } from './enterprise-grace.service';
import { EntitlementsController } from './entitlements.controller';

@Module({
  imports: [
    SupabaseModule,
    RedisModule,
    FeaturesModule,
    forwardRef(() => OrgBillingModule),
  ],
  providers: [EntitlementsService, EnterpriseGraceService],
  controllers: [EntitlementsController],
  exports: [EntitlementsService, EnterpriseGraceService],
})
export class EntitlementsModule {}
