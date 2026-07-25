import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../supabase/supabase.module';
import { SocialConnectController } from './social-connect.controller';
import { SocialConnectService } from './social-connect.service';
import { SocialConnectReconciler } from './social-connect-reconciler.service';
import { LateClientService } from './late-client.service';

/**
 * Seamless social-account connection via the Late (getlate.dev / Zernio)
 * aggregator — Instagram, Facebook, TikTok, LinkedIn, X. YouTube is EXCLUDED
 * (it keeps its own direct OAuth integration in content-pipeline).
 *
 * Self-contained: SupabaseModule is @Global but imported explicitly to mirror
 * the sibling content-pipeline module and keep AdminGuard's deps resolvable.
 *
 * WIRING TODO (team lead): add `SocialConnectModule` to the `imports` array of
 * `app.module.ts` (or content-pipeline.module.ts). No other change is needed —
 * the controller registers its own `api/admin/social-connect` routes.
 */
@Module({
  imports: [SupabaseModule, ConfigModule],
  controllers: [SocialConnectController],
  providers: [SocialConnectService, SocialConnectReconciler, LateClientService],
  exports: [SocialConnectService, LateClientService],
})
export class SocialConnectModule {}
