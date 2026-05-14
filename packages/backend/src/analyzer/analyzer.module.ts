import { Module } from '@nestjs/common';
import { AnalyzerController } from './analyzer.controller';
import { AnalyzerService } from './analyzer.service';
import { MetricResolutionModule } from '../metric-resolution/metric-resolution.module';
import { ScoringModule } from '../scoring/scoring.module';

@Module({
  imports: [MetricResolutionModule, ScoringModule],
  controllers: [AnalyzerController],
  providers: [AnalyzerService],
  exports: [AnalyzerService],
})
export class AnalyzerModule {}
