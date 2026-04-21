import { Module } from '@nestjs/common';
import { ContentPipelineController } from './content-pipeline.controller';
import { ContentPipelineService } from './content-pipeline.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [ContentPipelineController],
  providers: [ContentPipelineService],
  exports: [ContentPipelineService],
})
export class ContentPipelineModule {}
