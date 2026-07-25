import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { BrandKitService } from './brand-kit/brand-kit.service';
import { BrandKitController } from './brand-kit/brand-kit.controller';
import { PostsService } from './posts/posts.service';
import { PostsController } from './posts/posts.controller';

/**
 * Phase 2 foundation: the generalized posts model + brand kit. Both services are
 * self-contained (Supabase only), so they live in their own feature module that
 * ContentPipelineModule imports. Exported so the feed generator (which lives in
 * ContentPipelineModule) can inject them.
 */
@Module({
  imports: [SupabaseModule],
  controllers: [BrandKitController, PostsController],
  providers: [BrandKitService, PostsService],
  exports: [BrandKitService, PostsService],
})
export class PostsBrandKitModule {}
