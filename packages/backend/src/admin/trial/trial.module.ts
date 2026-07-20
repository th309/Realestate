import { Module } from '@nestjs/common';
import { TrialController } from './trial.controller';
import { TrialService } from './trial.service';
import { TrialActionsService } from './trial-actions.service';
import { SupabaseModule } from '../../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [TrialController],
  providers: [TrialService, TrialActionsService],
  exports: [TrialService, TrialActionsService],
})
export class TrialModule {}
