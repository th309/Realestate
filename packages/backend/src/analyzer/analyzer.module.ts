import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { AnalyzerController } from './analyzer.controller';
import { AnalyzerService } from './analyzer.service';
import { FreePreviewMiddleware } from './free-preview.middleware';
import { MetricResolutionModule } from '../metric-resolution/metric-resolution.module';
import { ScoringModule } from '../scoring/scoring.module';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [MetricResolutionModule, ScoringModule, SupabaseModule],
  controllers: [AnalyzerController],
  providers: [AnalyzerService, FreePreviewMiddleware],
  exports: [AnalyzerService],
})
export class AnalyzerModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(FreePreviewMiddleware)
      .forRoutes(
        { path: 'api/analyzer/market-context', method: RequestMethod.GET },
        { path: 'api/analyzer/ai-verdict', method: RequestMethod.POST },
      );
  }
}
