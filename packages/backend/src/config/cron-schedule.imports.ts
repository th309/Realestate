import type { DynamicModule } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';

/**
 * Schedule-module registration, gated on the RUN_CRONS env flag.
 *
 * The dev Railway service AND local dev both run the production build
 * (NODE_ENV=production) and point at the production Supabase DB, so NODE_ENV
 * cannot distinguish the single instance that should own scheduled jobs.
 * RUN_CRONS, set on exactly ONE prod service, makes cron ownership explicit.
 * When it is not exactly "true", `@Cron` handlers are never registered and no
 * scheduled job runs anywhere in this process.
 *
 * Read at module-evaluation time, so it must be a process.env check (ConfigService
 * is not yet available when the AppModule imports array is built).
 */
export function cronScheduleImports(): DynamicModule[] {
  return process.env.RUN_CRONS === 'true' ? [ScheduleModule.forRoot()] : [];
}
