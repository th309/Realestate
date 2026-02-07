import { Module } from '@nestjs/common';
import { TrialController } from './trial.controller';
import { TrialService } from './trial.service';
import { SupabaseModule } from '../../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [TrialController],
  providers: [TrialService],
  exports: [TrialService],
})
export class TrialModule {}
