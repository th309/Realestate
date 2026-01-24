import { Controller, Post, Body, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { CensusService } from './sources/census.service';
import { FredService } from './sources/fred.service';
import { ZillowService } from './sources/zillow.service';
import { RedfinService } from './sources/redfin.service';
import { CensusGeoLevel } from './types';

@Controller('data-ingestion')
export class DataIngestionController {
    constructor(
        private readonly censusService: CensusService,
        private readonly fredService: FredService,
        private readonly zillowService: ZillowService,
        private readonly redfinService: RedfinService
    ) { }

    @Post('census')
    @HttpCode(HttpStatus.OK)
    async importCensus(
        @Body() body: { datasets?: string[]; year?: number; geoLevel?: CensusGeoLevel },
        @Query('api_key') apiKey?: string
    ) {
        const { datasets, year, geoLevel } = body;
        // Note: frontend passes 'variables' but here we mapped to 'datasets' in the plan?
        // Let's support both or stick to 'variables' to match frontend usage if easier
        // Plan said: datasets: string[] // e.g., ["acs5", "population"] which isn't exactly what 'variables' was.
        // 'variables' were specific metric keys like 'population', 'median_household_income'.
        // I will use 'variables' to match the frontend implementation details I just ported.

        // Actually, looking at the code I just wrote in CensusService, it accepts 'variables'.
        // So I will accept 'variables' in the body.

        return this.censusService.importCensusData(
            (body as any).variables || datasets,
            year,
            geoLevel,
            apiKey
        );
    }

    @Post('fred')
    @HttpCode(HttpStatus.OK)
    async importFred(
        @Body() body: { series?: string[]; startDate?: string },
        @Query('api_key') apiKey?: string
    ) {
        return this.fredService.importFREDData(body.series, apiKey);
    }

    @Post('zillow')
    @HttpCode(HttpStatus.OK)
    async importZillow(
        @Body() body: { metric?: string; limit?: number }
    ) {
        return this.zillowService.importZillowData(body.metric, body.limit);
    }

    @Post('redfin')
    @HttpCode(HttpStatus.OK)
    async importRedfin(
        @Body() body: { metric?: string; limit?: number; url?: string }
    ) {
        return this.redfinService.importRedfinData(body.metric, body.limit, undefined, body.url);
    }
}
