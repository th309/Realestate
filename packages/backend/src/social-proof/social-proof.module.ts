import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { RedisModule } from '../redis/redis.module';
import { SocialProofService } from './social-proof.service';
import { SocialProofController } from './social-proof.controller';

@Module({
  imports: [SupabaseModule, RedisModule],
  controllers: [SocialProofController],
  providers: [SocialProofService],
  exports: [SocialProofService],
})
export class SocialProofModule {}
