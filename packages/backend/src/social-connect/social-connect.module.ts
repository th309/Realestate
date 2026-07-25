import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../supabase/supabase.module';
import { PostsBrandKitModule } from '../content-pipeline/posts-brand-kit.module';
import { SocialConnectController } from './social-connect.controller';
import { SocialConnectService } from './social-connect.service';
import { SocialConnectReconciler } from './social-connect-reconciler.service';
import { LateClientService } from './late-client.service';
import { PostPublisherService } from './post-publisher.service';
import { PublishSchedulerCron } from './publish-scheduler.cron';

/**
 * Seamless social-account connection via the Late (getlate.dev / Zernio)
 * aggregator — Instagram, Facebook, TikTok, LinkedIn, X. YouTube is EXCLUDED
 * (it keeps its own direct OAuth integration in content-pipeline).
 *
 * Also hosts Phase 5 automated publishing: PublishSchedulerCron scans due
 * scheduled posts and PostPublisherService publishes them through Late. Imports
 * PostsBrandKitModule for PostsService (the posts lifecycle).
 *
 * Self-contained: SupabaseModule is @Global but imported explicitly to mirror
 * the sibling content-pipeline module and keep AdminGuard's deps resolvable.
 *
 * WIRING TODO (team lead): add `SocialConnectModule` to the `imports` array of
 * `app.module.ts`. No other change is needed — the controller registers its own
 * `api/admin/social-connect` routes, and the cron only fires when RUN_CRONS=true.
 */
@Module({
  imports: [SupabaseModule, ConfigModule, PostsBrandKitModule],
  controllers: [SocialConnectController],
  providers: [
    SocialConnectService,
    SocialConnectReconciler,
    LateClientService,
    PostPublisherService,
    PublishSchedulerCron,
  ],
  exports: [SocialConnectService, LateClientService],
})
export class SocialConnectModule {}
