import { Module } from '@nestjs/common';
import { MarketAnalysisController } from './market-analysis.controller';
import { MarketAnalysisService } from './market-analysis.service';
import { MarketHeadlineService } from './market-headline.service';
import { ReportsModule } from '../reports/reports.module';

@Module({
  imports: [ReportsModule],
  controllers: [MarketAnalysisController],
  providers: [MarketAnalysisService, MarketHeadlineService],
})
export class MarketAnalysisModule {}
