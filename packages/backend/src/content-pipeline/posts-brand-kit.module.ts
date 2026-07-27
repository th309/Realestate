import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { BrandKitService } from './brand-kit/brand-kit.service';
import { BrandKitController } from './brand-kit/brand-kit.controller';
import { PostsService } from './posts/posts.service';
import { PostsController } from './posts/posts.controller';
import { StylePreferenceService } from './style-preferences/style-preference.service';
import { StylePreferenceController } from './style-preferences/style-preference.controller';
import { WeeklySchedulePlanService } from './scheduling/weekly-schedule-plan.service';
import { PostAutoSchedulerService } from './scheduling/post-auto-scheduler.service';

/**
 * Phase 2 foundation: the generalized posts model + brand kit, the Phase 8
 * style-preference loop, and the auto-scheduler. All self-contained (Supabase
 * only), so they live in their own feature module that ContentPipelineModule
 * imports. Exported so ContentPipelineModule's feed generator and
 * AutoScheduleApprovedPostsCron can inject them.
 *
 * PostAutoSchedulerService and WeeklySchedulePlanService live HERE rather than
 * in ContentPipelineModule specifically because PostsController (also in this
 * module) injects PostAutoSchedulerService directly to schedule a post right
 * after approval — a controller can only inject providers from its own module,
 * not from a module that merely imports the one it lives in.
 */
@Module({
  imports: [SupabaseModule],
  controllers: [BrandKitController, PostsController, StylePreferenceController],
  providers: [
    BrandKitService,
    PostsService,
    StylePreferenceService,
    WeeklySchedulePlanService,
    PostAutoSchedulerService,
  ],
  exports: [
    BrandKitService,
    PostsService,
    StylePreferenceService,
    WeeklySchedulePlanService,
    PostAutoSchedulerService,
  ],
})
export class PostsBrandKitModule {}
