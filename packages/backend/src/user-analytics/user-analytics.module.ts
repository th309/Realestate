import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { SupabaseModule } from '../supabase/supabase.module';
import { RedisModule } from '../redis/redis.module';
import { EventIngestionController } from './event-ingestion.controller';
import { EventIngestionService } from './event-ingestion.service';
import { SessionManagerService } from './session-manager.service';
import { IdentityStitchingService } from './identity-stitching.service';

@Module({
  imports: [
    SupabaseModule,
    RedisModule,
    ConfigModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
  ],
  controllers: [EventIngestionController],
  providers: [
    EventIngestionService,
    SessionManagerService,
    IdentityStitchingService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
  exports: [
    EventIngestionService,
    SessionManagerService,
    IdentityStitchingService,
  ],
})
export class UserAnalyticsModule {}
