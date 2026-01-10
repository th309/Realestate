import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseModule } from './supabase/supabase.module';
import { MarketsModule } from './markets/markets.module';
import { ZillowModule } from './zillow/zillow.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    SupabaseModule,
    MarketsModule,
    ZillowModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
