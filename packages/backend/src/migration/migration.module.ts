import { Module } from '@nestjs/common';
import { MigrationService } from './migration.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [MigrationService],
  exports: [MigrationService],
})
export class MigrationModule {}
