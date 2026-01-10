import { Controller, Get, Query, Param } from '@nestjs/common';
import { ZillowService } from './zillow.service';

@Controller('api/zillow')
export class ZillowController {
  constructor(private readonly zillowService: ZillowService) {}

  @Get('states')
  async getStateHomeValues(@Query('date') date?: string) {
    const data = await this.zillowService.getStateHomeValues(date);
    return {
      success: true,
      count: data.length,
      geography: 'State',
      data,
    };
  }

  @Get('metros')
  async getMetroHomeValues(
    @Query('date') date?: string,
    @Query('state') state?: string,
  ) {
    const data = await this.zillowService.getMetroHomeValues(date, state);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      data,
    };
  }

  @Get('counties')
  async getCountyHomeValues(
    @Query('date') date?: string,
    @Query('state') state?: string,
  ) {
    const data = await this.zillowService.getCountyHomeValues(date, state);
    return {
      success: true,
      count: data.length,
      geography: 'County',
      data,
    };
  }

  @Get('zips')
  async getZipHomeValues(
    @Query('state') state: string,
    @Query('county') county?: string,
    @Query('date') date?: string,
  ) {
    if (!state) {
      return {
        success: false,
        error: 'State parameter is required for ZIP-level data',
      };
    }
    const data = await this.zillowService.getZipHomeValues(state, county, date);
    return {
      success: true,
      count: data.length,
      geography: 'ZIP',
      data,
    };
  }

  @Get('dates')
  async getAvailableDates(@Query('geography') geography: string = 'State') {
    const dates = await this.zillowService.getAvailableDates(geography);
    return {
      success: true,
      geography,
      dates,
    };
  }

  @Get('timeseries/:regionId')
  async getTimeSeries(
    @Param('regionId') regionId: string,
    @Query('geography') geography: string = 'State',
  ) {
    const data = await this.zillowService.getTimeSeries(regionId, geography);
    return {
      success: true,
      regionId,
      geography,
      count: data.length,
      data,
    };
  }
}
