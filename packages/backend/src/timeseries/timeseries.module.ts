import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TimeSeriesController } from './timeseries.controller';
import { TimeSeriesService } from './timeseries.service';

// Import all entity classes needed for time series queries
// These will be added based on your existing entity definitions

@Module({
    imports: [
        TypeOrmModule.forFeature([
            // Zillow entities will be imported here
            // Realtor entities will be imported here
            // Census entities will be imported here
            // Economic entities will be imported here
        ]),
    ],
    controllers: [TimeSeriesController],
    providers: [TimeSeriesService],
    exports: [TimeSeriesService],
})
export class TimeSeriesModule { }
