import { Module } from '@nestjs/common';
import { MarketsController } from './markets.controller';
import { MarketsService } from './markets.service';
import { PeersService } from './peers.service';
import { MarketsCoreService } from './internal/markets-core.service';
import { MarketsGeographiesService } from './internal/markets-geographies.service';
import { MarketsHomeValuesService } from './internal/markets-home-values.service';
import { MarketsSearchService } from './internal/markets-search.service';

@Module({
  controllers: [MarketsController],
  providers: [
    MarketsService, // public facade
    PeersService, // public
    // Internal per-domain services — providers only, not exported.
    MarketsCoreService,
    MarketsGeographiesService,
    MarketsHomeValuesService,
    MarketsSearchService,
  ],
  exports: [MarketsService, PeersService],
})
export class MarketsModule {}
