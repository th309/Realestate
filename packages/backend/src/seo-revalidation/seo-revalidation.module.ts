import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { SeoRevalidationService } from './seo-revalidation.service';

@Module({
  imports: [SupabaseModule],
  providers: [SeoRevalidationService],
})
export class SeoRevalidationModule {}
