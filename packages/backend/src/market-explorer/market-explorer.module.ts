import { Module } from '@nestjs/common';
import { MarketExplorerController } from './market-explorer.controller';
import { MarketExplorerService } from './market-explorer.service';

@Module({
  controllers: [MarketExplorerController],
  providers: [MarketExplorerService],
  exports: [MarketExplorerService],
})
export class MarketExplorerModule {}
