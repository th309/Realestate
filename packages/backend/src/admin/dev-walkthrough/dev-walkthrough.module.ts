// dev-walkthrough.module.ts
import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../supabase/supabase.module';
import { EmailModule } from '../../email/email.module';
import { UsersModule } from '../users/users.module';
import { DevWalkthroughController } from './dev-walkthrough.controller';
import { DevWalkthroughService } from './dev-walkthrough.service';

@Module({
  imports: [SupabaseModule, EmailModule, UsersModule],
  controllers: [DevWalkthroughController],
  providers: [DevWalkthroughService],
})
export class DevWalkthroughModule {}
