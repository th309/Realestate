import { Module } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { PartnersController } from './partners.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';

@Module({
  imports: [SupabaseModule, EntitlementsModule],
  providers: [PartnersService],
  controllers: [PartnersController],
  exports: [PartnersService],
})
export class PartnersModule {}
