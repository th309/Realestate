import { Module } from '@nestjs/common';
import { MarketsController } from './markets.controller';
import { MarketsService } from './markets.service';
import { PeersService } from './peers.service';

@Module({
  controllers: [MarketsController],
  providers: [MarketsService, PeersService],
  exports: [MarketsService, PeersService],
})
export class MarketsModule {}
