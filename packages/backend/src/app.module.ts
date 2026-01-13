import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './supabase/supabase.module';
import { MarketsModule } from './markets/markets.module';
import { ZillowModule } from './zillow/zillow.module';
import { ScoringModule } from './scoring/scoring.module';
import { GeographyModule } from './geography/geography.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    SupabaseModule,
    MarketsModule,
    ZillowModule,
    ScoringModule,
    GeographyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
