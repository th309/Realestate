import { Module } from '@nestjs/common';
import { MigrationController } from './migration.controller';
import { MigrationService } from './migration.service';

// SupabaseService is provided by the global SupabaseModule (see app.module.ts).
@Module({
  controllers: [MigrationController],
  providers: [MigrationService],
})
export class MigrationModule {}
