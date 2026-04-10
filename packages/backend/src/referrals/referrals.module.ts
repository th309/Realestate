import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { EmailModule } from '../email/email.module';
import { ReferralsService } from './referrals.service';
import { ReferralsController } from './referrals.controller';

@Module({
  imports: [SupabaseModule, EmailModule],
  providers: [ReferralsService],
  controllers: [ReferralsController],
})
export class ReferralsModule {}
