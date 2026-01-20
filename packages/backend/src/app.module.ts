// Backend v1.2.0 - Added affordable_home_price endpoints
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './supabase/supabase.module';
import { MarketsModule } from './markets/markets.module';
import { ZillowModule } from './zillow/zillow.module';
import { RealtorModule } from './realtor/realtor.module';
import { ScoringModule } from './scoring/scoring.module';
import { GeographyModule } from './geography/geography.module';
import { MetricsModule } from './metrics/metrics.module';
import { CensusModule } from './census/census.module';
import { EconomicModule } from './economic/economic.module';
import { ReportsModule } from './reports/reports.module';
import { TimeSeriesModule } from './timeseries/timeseries.module';
import { PermitsModule } from './permits/permits.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    SupabaseModule,
    MarketsModule,
    ZillowModule,
    RealtorModule,
    ScoringModule,
    GeographyModule,
    MetricsModule,
    CensusModule,
    EconomicModule,
    ReportsModule,
    TimeSeriesModule,
    PermitsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
