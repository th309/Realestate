import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CensusService } from './sources/census.service';
import { FredService } from './sources/fred.service';
import { ZillowService } from './sources/zillow.service';
import { RedfinService } from './sources/redfin.service';
import { RealtorService } from './sources/realtor.service';
import {
  ImportCensusDto,
  ImportFredDto,
  ImportZillowDto,
  ImportRedfinDto,
  ImportRealtorDto,
} from './dto';
import { AdminGuard } from '../common/guards/admin-auth.guard';

@UseGuards(AdminGuard)
@Controller('api/data-ingestion')
export class DataIngestionController {
  constructor(
    private readonly censusService: CensusService,
    private readonly fredService: FredService,
    private readonly zillowService: ZillowService,
    private readonly redfinService: RedfinService,
    private readonly realtorService: RealtorService,
  ) {}

  @Post('census')
  @HttpCode(HttpStatus.OK)
  async importCensus(
    @Body() body: ImportCensusDto,
    @Query('api_key') apiKey?: string,
  ) {
    const { variables, datasets, year, geoLevel } = body;
    // Newer clients send `variables` (specific metric keys); older callers send
    // `datasets`. Prefer `variables`, falling back to `datasets`.
    return this.censusService.importCensusData(
      variables || datasets,
      year,
      geoLevel,
      apiKey,
    );
  }

  @Post('fred')
  @HttpCode(HttpStatus.OK)
  async importFred(
    @Body() body: ImportFredDto,
    @Query('api_key') apiKey?: string,
  ) {
    return this.fredService.importFREDData(body.series, apiKey);
  }

  @Post('zillow')
  @HttpCode(HttpStatus.OK)
  async importZillow(@Body() body: ImportZillowDto) {
    return this.zillowService.importZillowData(body.metric, body.limit);
  }

  @Post('redfin')
  @HttpCode(HttpStatus.OK)
  async importRedfin(@Body() body: ImportRedfinDto) {
    return this.redfinService.importRedfinData(
      body.metric,
      body.limit,
      body.csvContent,
      body.url,
    );
  }

  @Post('realtor')
  @HttpCode(HttpStatus.OK)
  async importRealtor(@Body() body: ImportRealtorDto) {
    if (body.datasetId) {
      return this.realtorService.importDataset(body.datasetId, body.limit);
    } else {
      return this.realtorService.importAllRealtorData(body.limit);
    }
  }
}
