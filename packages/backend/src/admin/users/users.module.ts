import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { SupabaseModule } from '../../supabase/supabase.module';
import { RedisModule } from '../../redis/redis.module';
import { FeaturesModule } from '../features/features.module';

@Module({
  imports: [SupabaseModule, RedisModule, FeaturesModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
