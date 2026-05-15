import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RentcastService } from './rentcast.service';

/**
 * RentcastModule
 *
 * Exposes `RentcastService` for downstream callers (e.g. AnalyzerModule).
 * `RedisModule` is `@Global()` so we don't import it explicitly — `RedisService`
 * is injectable anywhere in the app.
 */
@Module({
  imports: [ConfigModule],
  providers: [RentcastService],
  exports: [RentcastService],
})
export class RentcastModule {}
