import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../supabase/supabase.module';
import { PushController } from './push.controller';
import { PushService } from './push.service';
import { PushSubscriptionsDataService } from './push-subscriptions.data';

@Module({
  imports: [SupabaseModule, ConfigModule],
  controllers: [PushController],
  providers: [PushService, PushSubscriptionsDataService],
  exports: [PushService],
})
export class PushModule {}
