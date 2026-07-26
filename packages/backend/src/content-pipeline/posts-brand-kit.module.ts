import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { BrandKitService } from './brand-kit/brand-kit.service';
import { BrandKitController } from './brand-kit/brand-kit.controller';
import { PostsService } from './posts/posts.service';
import { PostsController } from './posts/posts.controller';
import { StylePreferenceService } from './style-preferences/style-preference.service';
import { StylePreferenceController } from './style-preferences/style-preference.controller';

/**
 * Phase 2 foundation: the generalized posts model + brand kit, plus the Phase 8
 * style-preference loop that extends the brand preamble with the references an
 * operator has liked. All three services are self-contained (Supabase only), so
 * they live in their own feature module that ContentPipelineModule imports.
 * Exported so the feed generator (which lives in ContentPipelineModule) can
 * inject them.
 */
@Module({
  imports: [SupabaseModule],
  controllers: [BrandKitController, PostsController, StylePreferenceController],
  providers: [BrandKitService, PostsService, StylePreferenceService],
  exports: [BrandKitService, PostsService, StylePreferenceService],
})
export class PostsBrandKitModule {}
