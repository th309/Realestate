import { Module } from '@nestjs/common';
import { DataIngestionController } from './data-ingestion.controller';
import { CensusService } from './sources/census.service';
import { FredService } from './sources/fred.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { GeoMappingService } from './utils/geo-mapping.service';
import { DataQualityService } from './utils/data-quality.service';
import { ZillowService } from './sources/zillow.service';
import { RedfinService } from './sources/redfin.service';
import { RedfinPuppeteerService } from './sources/redfin-puppeteer.service';
import { RealtorService } from './sources/realtor.service';

@Module({
    imports: [SupabaseModule],
    controllers: [DataIngestionController],
    providers: [
        CensusService,
        FredService,
        ZillowService,
        RedfinService,
        RedfinPuppeteerService,
        RealtorService,
        GeoMappingService,
        DataQualityService
    ],
    exports: [
        CensusService,
        FredService,
        ZillowService,
        RedfinService,
        RedfinPuppeteerService,
        RealtorService,
        GeoMappingService,
        DataQualityService
    ]
})
export class DataIngestionModule { }
