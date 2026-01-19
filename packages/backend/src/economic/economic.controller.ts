import { Controller, Get, Query } from '@nestjs/common';
import { EconomicService } from './economic.service';

@Controller('api/economic')
export class EconomicController {
  constructor(private readonly economicService: EconomicService) {}

  // ============================================================================
  // Unemployment Rate
  // ============================================================================

  @Get('unemployment/national')
  async getUnemploymentNational(@Query('date') date?: string) {
    return this.economicService.getNationalUnemployment(date);
  }

  @Get('unemployment/states')
  async getUnemploymentStates(@Query('date') date?: string) {
    return this.economicService.getStateUnemployment(date);
  }

  @Get('unemployment/metros')
  async getUnemploymentMetros(@Query('date') date?: string) {
    return this.economicService.getMetroUnemployment(date);
  }

  @Get('unemployment/counties')
  async getUnemploymentCounties(@Query('date') date?: string) {
    return this.economicService.getCountyUnemployment(date);
  }

  // ============================================================================
  // Job Growth
  // ============================================================================

  @Get('job-growth/national')
  async getJobGrowthNational(@Query('date') date?: string) {
    return this.economicService.getNationalJobGrowth(date);
  }

  @Get('job-growth/states')
  async getJobGrowthStates(@Query('date') date?: string) {
    return this.economicService.getStateJobGrowth(date);
  }

  @Get('job-growth/metros')
  async getJobGrowthMetros(@Query('date') date?: string) {
    return this.economicService.getMetroJobGrowth(date);
  }

  @Get('job-growth/counties')
  async getJobGrowthCounties(@Query('date') date?: string) {
    return this.economicService.getCountyJobGrowth(date);
  }

  // ============================================================================
  // GDP Growth
  // ============================================================================

  @Get('gdp-growth/national')
  async getGdpGrowthNational(@Query('date') date?: string) {
    return this.economicService.getNationalGdpGrowth(date);
  }

  @Get('gdp-growth/states')
  async getGdpGrowthStates(@Query('date') date?: string) {
    return this.economicService.getStateGdpGrowth(date);
  }

  @Get('gdp-growth/metros')
  async getGdpGrowthMetros(@Query('date') date?: string) {
    return this.economicService.getMetroGdpGrowth(date);
  }

  @Get('gdp-growth/counties')
  async getGdpGrowthCounties(@Query('date') date?: string) {
    return this.economicService.getCountyGdpGrowth(date);
  }

  // ============================================================================
  // Cost of Living
  // ============================================================================

  @Get('cost-of-living/states')
  async getCostOfLivingStates(@Query('date') date?: string) {
    return this.economicService.getStateCostOfLiving(date);
  }

  @Get('cost-of-living/metros')
  async getCostOfLivingMetros(@Query('date') date?: string) {
    return this.economicService.getMetroCostOfLiving(date);
  }
}
