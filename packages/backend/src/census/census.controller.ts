import { Controller, Get, Query } from '@nestjs/common';
import { CensusService } from './census.service';

@Controller('census')
export class CensusController {
  constructor(private readonly censusService: CensusService) {}

  // ============================================================================
  // Population
  // ============================================================================

  @Get('population/national')
  async getPopulationNational(@Query('year') year?: string) {
    return this.censusService.getNationalPopulation(year ? parseInt(year) : undefined);
  }

  @Get('population/states')
  async getPopulationStates(@Query('year') year?: string) {
    return this.censusService.getStatePopulation(year ? parseInt(year) : undefined);
  }

  @Get('population/metros')
  async getPopulationMetros(@Query('year') year?: string) {
    return this.censusService.getMetroPopulation(year ? parseInt(year) : undefined);
  }

  @Get('population/counties')
  async getPopulationCounties(@Query('year') year?: string) {
    return this.censusService.getCountyPopulation(year ? parseInt(year) : undefined);
  }

  @Get('population/zips')
  async getPopulationZips(
    @Query('year') year?: string,
    @Query('state') state?: string,
  ) {
    return this.censusService.getZipPopulation(year ? parseInt(year) : undefined, state);
  }

  // ============================================================================
  // Population Growth
  // ============================================================================

  @Get('population-growth/national')
  async getPopulationGrowthNational(@Query('year') year?: string) {
    return this.censusService.getNationalPopulationGrowth(year ? parseInt(year) : undefined);
  }

  @Get('population-growth/states')
  async getPopulationGrowthStates(@Query('year') year?: string) {
    return this.censusService.getStatePopulationGrowth(year ? parseInt(year) : undefined);
  }

  @Get('population-growth/metros')
  async getPopulationGrowthMetros(@Query('year') year?: string) {
    return this.censusService.getMetroPopulationGrowth(year ? parseInt(year) : undefined);
  }

  @Get('population-growth/counties')
  async getPopulationGrowthCounties(@Query('year') year?: string) {
    return this.censusService.getCountyPopulationGrowth(year ? parseInt(year) : undefined);
  }

  @Get('population-growth/zips')
  async getPopulationGrowthZips(
    @Query('year') year?: string,
    @Query('state') state?: string,
  ) {
    return this.censusService.getZipPopulationGrowth(year ? parseInt(year) : undefined, state);
  }

  // ============================================================================
  // Median Income
  // ============================================================================

  @Get('median-income/national')
  async getMedianIncomeNational(@Query('year') year?: string) {
    return this.censusService.getNationalMedianIncome(year ? parseInt(year) : undefined);
  }

  @Get('median-income/states')
  async getMedianIncomeStates(@Query('year') year?: string) {
    return this.censusService.getStateMedianIncome(year ? parseInt(year) : undefined);
  }

  @Get('median-income/metros')
  async getMedianIncomeMetros(@Query('year') year?: string) {
    return this.censusService.getMetroMedianIncome(year ? parseInt(year) : undefined);
  }

  @Get('median-income/counties')
  async getMedianIncomeCounties(@Query('year') year?: string) {
    return this.censusService.getCountyMedianIncome(year ? parseInt(year) : undefined);
  }

  @Get('median-income/zips')
  async getMedianIncomeZips(
    @Query('year') year?: string,
    @Query('state') state?: string,
  ) {
    return this.censusService.getZipMedianIncome(year ? parseInt(year) : undefined, state);
  }

  // ============================================================================
  // Income Growth
  // ============================================================================

  @Get('income-growth/national')
  async getIncomeGrowthNational(@Query('year') year?: string) {
    return this.censusService.getNationalIncomeGrowth(year ? parseInt(year) : undefined);
  }

  @Get('income-growth/states')
  async getIncomeGrowthStates(@Query('year') year?: string) {
    return this.censusService.getStateIncomeGrowth(year ? parseInt(year) : undefined);
  }

  @Get('income-growth/metros')
  async getIncomeGrowthMetros(@Query('year') year?: string) {
    return this.censusService.getMetroIncomeGrowth(year ? parseInt(year) : undefined);
  }

  @Get('income-growth/counties')
  async getIncomeGrowthCounties(@Query('year') year?: string) {
    return this.censusService.getCountyIncomeGrowth(year ? parseInt(year) : undefined);
  }

  @Get('income-growth/zips')
  async getIncomeGrowthZips(
    @Query('year') year?: string,
    @Query('state') state?: string,
  ) {
    return this.censusService.getZipIncomeGrowth(year ? parseInt(year) : undefined, state);
  }

  // ============================================================================
  // Median Age
  // ============================================================================

  @Get('median-age/national')
  async getMedianAgeNational(@Query('year') year?: string) {
    return this.censusService.getNationalMedianAge(year ? parseInt(year) : undefined);
  }

  @Get('median-age/states')
  async getMedianAgeStates(@Query('year') year?: string) {
    return this.censusService.getStateMedianAge(year ? parseInt(year) : undefined);
  }

  @Get('median-age/metros')
  async getMedianAgeMetros(@Query('year') year?: string) {
    return this.censusService.getMetroMedianAge(year ? parseInt(year) : undefined);
  }

  @Get('median-age/counties')
  async getMedianAgeCounties(@Query('year') year?: string) {
    return this.censusService.getCountyMedianAge(year ? parseInt(year) : undefined);
  }

  @Get('median-age/zips')
  async getMedianAgeZips(
    @Query('year') year?: string,
    @Query('state') state?: string,
  ) {
    return this.censusService.getZipMedianAge(year ? parseInt(year) : undefined, state);
  }

  // ============================================================================
  // Homeownership Rate
  // ============================================================================

  @Get('homeownership-rate/national')
  async getHomeownershipNational(@Query('year') year?: string) {
    return this.censusService.getNationalHomeownership(year ? parseInt(year) : undefined);
  }

  @Get('homeownership-rate/states')
  async getHomeownershipStates(@Query('year') year?: string) {
    return this.censusService.getStateHomeownership(year ? parseInt(year) : undefined);
  }

  @Get('homeownership-rate/metros')
  async getHomeownershipMetros(@Query('year') year?: string) {
    return this.censusService.getMetroHomeownership(year ? parseInt(year) : undefined);
  }

  @Get('homeownership-rate/counties')
  async getHomeownershipCounties(@Query('year') year?: string) {
    return this.censusService.getCountyHomeownership(year ? parseInt(year) : undefined);
  }

  @Get('homeownership-rate/zips')
  async getHomeownershipZips(
    @Query('year') year?: string,
    @Query('state') state?: string,
  ) {
    return this.censusService.getZipHomeownership(year ? parseInt(year) : undefined, state);
  }
}
