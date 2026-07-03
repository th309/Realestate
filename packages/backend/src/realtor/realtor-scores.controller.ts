import { Controller, Get, Query } from '@nestjs/common';
import { RealtorService } from './realtor.service';

@Controller('api/realtor')
export class RealtorScoresController {
  constructor(private readonly realtorService: RealtorService) {}

  // ============================================================================
  // National Average (for benchmarks)
  // ============================================================================

  @Get('national-average')
  async getNationalAverage(@Query('metric') metric: string) {
    const data = await this.realtorService.getNationalAverage(metric);
    return { success: true, ...data };
  }

  @Get('benchmarks')
  async getBenchmarks(
    @Query('geoLevel') geoLevel: string,
    @Query('regionId') regionId: string,
    @Query('stateId') stateId?: string,
  ) {
    const data = await this.realtorService.getBenchmarks(
      geoLevel,
      regionId,
      stateId,
    );
    return { success: true, ...data };
  }

  // ============================================================================
  // Hotness Score (hotness_score) - Metro/County/ZIP only
  // ============================================================================

  @Get('hotness/metros')
  async getMetroHotness(@Query('date') date?: string) {
    const data = await this.realtorService.getMetroHotness(date);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      metric: 'hotness_score',
      data,
    };
  }

  @Get('hotness/counties')
  async getCountyHotness(@Query('date') date?: string) {
    const data = await this.realtorService.getCountyHotness(date);
    return {
      success: true,
      count: data.length,
      geography: 'County',
      metric: 'hotness_score',
      data,
    };
  }

  @Get('hotness/zips')
  async getZipHotness(
    @Query('state') state?: string,
    @Query('date') date?: string,
  ) {
    const data = await this.realtorService.getZipHotness(state, date);
    return {
      success: true,
      count: data.length,
      geography: 'ZIP',
      metric: 'hotness_score',
      data,
    };
  }

  // ============================================================================
  // Supply Score (supply_score) - Metro/County/ZIP only
  // ============================================================================

  @Get('supply-score/metros')
  async getMetroSupplyScore(@Query('date') date?: string) {
    const data = await this.realtorService.getMetroSupplyScore(date);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      metric: 'supply_score',
      data,
    };
  }

  @Get('supply-score/counties')
  async getCountySupplyScore(@Query('date') date?: string) {
    const data = await this.realtorService.getCountySupplyScore(date);
    return {
      success: true,
      count: data.length,
      geography: 'County',
      metric: 'supply_score',
      data,
    };
  }

  @Get('supply-score/zips')
  async getZipSupplyScore(
    @Query('state') state?: string,
    @Query('date') date?: string,
  ) {
    const data = await this.realtorService.getZipSupplyScore(state, date);
    return {
      success: true,
      count: data.length,
      geography: 'ZIP',
      metric: 'supply_score',
      data,
    };
  }

  // ============================================================================
  // Demand Score (demand_score) - Metro/County/ZIP only
  // ============================================================================

  @Get('demand-score/metros')
  async getMetroDemandScore(@Query('date') date?: string) {
    const data = await this.realtorService.getMetroDemandScore(date);
    return {
      success: true,
      count: data.length,
      geography: 'Metro',
      metric: 'demand_score',
      data,
    };
  }

  @Get('demand-score/counties')
  async getCountyDemandScore(@Query('date') date?: string) {
    const data = await this.realtorService.getCountyDemandScore(date);
    return {
      success: true,
      count: data.length,
      geography: 'County',
      metric: 'demand_score',
      data,
    };
  }

  @Get('demand-score/zips')
  async getZipDemandScore(
    @Query('state') state?: string,
    @Query('date') date?: string,
  ) {
    const data = await this.realtorService.getZipDemandScore(state, date);
    return {
      success: true,
      count: data.length,
      geography: 'ZIP',
      metric: 'demand_score',
      data,
    };
  }
}
