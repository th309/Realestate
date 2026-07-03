import { Controller, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CalculatedMetricsService } from './calculated-metrics.service';

@ApiTags('metrics')
@Controller('api/metrics')
export class MetricsBatchController {
  constructor(
    private readonly calculatedMetricsService: CalculatedMetricsService,
  ) {}

  /**
   * Trigger batch calculation of investment metrics for all metros
   * Should be called monthly after new data is imported
   */
  @Post('calculate-investment-metrics')
  async calculateInvestmentMetricsBatch(@Query('year') year?: number) {
    const results =
      await this.calculatedMetricsService.calculateAllInvestmentMetrics(year);
    return {
      success: true,
      message: 'Investment metrics batch calculation completed',
      results,
      totals: {
        processed:
          results.investmentMetrics.processed + results.overvalued.processed,
        stored: results.investmentMetrics.stored + results.overvalued.stored,
      },
    };
  }

  /**
   * Trigger batch calculation of 5-year growth for all geographies
   * Should be called monthly after new data is imported
   */
  @Post('calculate-5yr-growth')
  async calculate5YrGrowthBatch(@Query('year') year?: number) {
    const results =
      await this.calculatedMetricsService.calculate5YrGrowthForAll(year);
    return {
      success: true,
      message: 'Batch calculation completed',
      results: {
        metros: results.metros,
        states: results.states,
        counties: results.counties,
        zips: results.zips,
        national: results.national,
      },
      totals: {
        processed:
          results.metros.processed +
          results.states.processed +
          results.counties.processed +
          results.zips.processed +
          results.national.processed,
        stored:
          results.metros.stored +
          results.states.stored +
          results.counties.stored +
          results.zips.stored +
          results.national.stored,
      },
    };
  }

  /**
   * Trigger batch calculation for a specific geography type
   */
  @Post('calculate-5yr-growth/:geoType')
  async calculate5YrGrowthByGeo(
    @Param('geoType') geoType: string,
    @Query('year') year?: number,
  ) {
    let result: { processed: number; stored: number };

    switch (geoType) {
      case 'metros':
        result =
          await this.calculatedMetricsService.calculate5YrGrowthForMetros(year);
        break;
      case 'states':
        result =
          await this.calculatedMetricsService.calculate5YrGrowthForStates(year);
        break;
      case 'counties':
        result =
          await this.calculatedMetricsService.calculate5YrGrowthForCounties();
        break;
      case 'zips':
        result =
          await this.calculatedMetricsService.calculate5YrGrowthForZips();
        break;
      case 'national':
        result =
          await this.calculatedMetricsService.calculate5YrGrowthForNational(
            year,
          );
        break;
      default:
        return { success: false, error: `Invalid geography type: ${geoType}` };
    }

    return {
      success: true,
      geography: geoType,
      ...result,
    };
  }
}
