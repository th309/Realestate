import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { MarketsService } from './markets.service';

@ApiTags('markets')
@Controller('markets')
export class MarketsController {
  constructor(private readonly marketsService: MarketsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get market statistics' })
  async getStats() {
    return this.marketsService.getMarketStats();
  }

  @Get('states')
  @ApiOperation({ summary: 'Get all states' })
  async getStates() {
    return this.marketsService.getStates();
  }

  @Get('states/home-values')
  @ApiOperation({ summary: 'Get median home values by state' })
  async getStateHomeValues() {
    return this.marketsService.getStateHomeValues();
  }

  @Get('metros')
  @ApiOperation({ summary: 'Get all metro areas (for client-side search)' })
  async getAllMetros() {
    return this.marketsService.getAllMetros();
  }

  @Get('metros/home-values')
  @ApiOperation({ summary: 'Get median home values by metro area (MSA)' })
  async getMetroHomeValues() {
    return this.marketsService.getMetroHomeValues();
  }

  @Get('metros/search')
  @ApiOperation({ summary: 'Search metro areas by name' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max results (default 10)',
  })
  async searchMetros(
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    return this.marketsService.searchMetros(
      query,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  @Get('counties')
  @ApiOperation({ summary: 'Get all counties (for client-side search)' })
  async getAllCounties() {
    return this.marketsService.getAllCounties();
  }

  @Get('counties/home-values')
  @ApiOperation({ summary: 'Get median home values by county' })
  async getCountyHomeValues() {
    return this.marketsService.getCountyHomeValues();
  }

  @Get('zips')
  @ApiOperation({ summary: 'Get all ZIP codes (for client-side search)' })
  async getAllZips() {
    return this.marketsService.getAllZips();
  }

  @Get('zips/home-values')
  @ApiOperation({ summary: 'Get median home values by ZIP code' })
  async getZipHomeValues() {
    return this.marketsService.getZipHomeValues();
  }

  @Get('states/:stateFp/counties')
  @ApiOperation({ summary: 'Get counties by state FIPS code' })
  @ApiParam({
    name: 'stateFp',
    description: 'State FIPS code (e.g., 17 for Illinois)',
  })
  async getCountiesByState(@Param('stateFp') stateFp: string) {
    return this.marketsService.getCountiesByState(stateFp);
  }

  @Get()
  @ApiOperation({ summary: 'Get markets with pagination' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getMarkets(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.marketsService.getMarkets(
      limit ? parseInt(limit, 10) : 100,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get market by ID' })
  @ApiParam({ name: 'id', description: 'Market ID' })
  async getMarketById(@Param('id') id: string) {
    return this.marketsService.getMarketById(id);
  }
}
