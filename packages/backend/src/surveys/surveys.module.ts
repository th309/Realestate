import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { SurveysService } from './surveys.service';
import { SurveysController } from './surveys.controller';
import { MilestonesController } from './milestones.controller';

@Module({
  imports: [SupabaseModule],
  controllers: [SurveysController, MilestonesController],
  providers: [SurveysService],
  exports: [SurveysService],
})
export class SurveysModule {}
