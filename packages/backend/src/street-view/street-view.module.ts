import { Module } from '@nestjs/common';
import { StreetViewService } from './street-view.service';
import { StreetViewController } from './street-view.controller';

@Module({
  controllers: [StreetViewController],
  providers: [StreetViewService],
  exports: [StreetViewService],
})
export class StreetViewModule {}
