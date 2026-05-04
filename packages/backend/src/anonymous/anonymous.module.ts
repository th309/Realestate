import { Module } from '@nestjs/common';
import { AnonymousController } from './anonymous.controller';
import { ListingPresentationService } from './listing-presentation.service';
import { ListingPresentationNarrativeService } from './listing-presentation-narrative.service';
import { ListingPresentationClaimService } from './listing-presentation-claim.service';
import { RedisTourCacheService } from './redis-tour-cache.service';
import { AnonRateLimitGuard } from './anon-rate-limit.guard';
import { RedisModule } from '../redis/redis.module';
import { ScoringModule } from '../scoring/scoring.module';
import { MetricResolutionModule } from '../metric-resolution/metric-resolution.module';
import { MarketsModule } from '../markets/markets.module';
import { MigrationModule } from '../migration/migration.module';
import { EmploymentSectorsModule } from '../employment-sectors/employment-sectors.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    RedisModule,
    ScoringModule,
    MetricResolutionModule,
    MarketsModule,
    MigrationModule,
    EmploymentSectorsModule,
    AiModule,
  ],
  controllers: [AnonymousController],
  providers: [
    ListingPresentationService,
    ListingPresentationNarrativeService,
    ListingPresentationClaimService,
    RedisTourCacheService,
    AnonRateLimitGuard,
  ],
  exports: [RedisTourCacheService, ListingPresentationClaimService],
})
export class AnonymousModule {}
