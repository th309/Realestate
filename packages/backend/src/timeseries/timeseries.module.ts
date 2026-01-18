import { Module } from '@nestjs/common';
import { TimeSeriesController } from './timeseries.controller';
import { TimeSeriesService } from './timeseries.service';

/**
 * TimeSeriesModule
 * 
 * Provides historical time-series data endpoints.
 * Uses Supabase client (injected via SUPABASE_CLIENT) to query the database.
 * No TypeORM entities needed - all queries use Supabase client directly.
 */
@Module({
    controllers: [TimeSeriesController],
    providers: [TimeSeriesService],
    exports: [TimeSeriesService],
})
export class TimeSeriesModule { }
