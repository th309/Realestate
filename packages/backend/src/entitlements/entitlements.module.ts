import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { FeaturesModule } from '../admin/features/features.module';
import { EntitlementsService } from './entitlements.service';
import { EntitlementsController } from './entitlements.controller';

@Module({
  imports: [SupabaseModule, FeaturesModule],
  providers: [EntitlementsService],
  controllers: [EntitlementsController],
  exports: [EntitlementsService],
})
export class EntitlementsModule {}
