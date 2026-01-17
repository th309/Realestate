import { Controller, Get, Post, Param, Query } from '@nestjs/common';
import { InventorySurplusService } from './inventory-surplus.service';

/**
 * Inventory Surplus API Controller
 *
 * Endpoints for calculating and retrieving inventory surplus/deficit data.
 * Follows the pattern: /api/metrics/inventory-surplus/{geo}
 */
@Controller('api/metrics/inventory-surplus')
export class InventorySurplusController {
  constructor(
    private readonly inventorySurplusService: InventorySurplusService,
  ) {}

  // ============================================================================
  // DATA RETRIEVAL ENDPOINTS
  // ============================================================================

  /**
   * Get inventory surplus for national level
   */
  @Get('national')
  async getNationalInventorySurplus() {
    const result = await this.inventorySurplusService.getForMap('national');

    if (!result.success || result.data.length === 0) {
      return {
        success: false,
        error: 'No inventory surplus data available for national',
        data: [],
      };
    }

    return {
      success: true,
      count: result.data.length,
      geography: 'National',
      metric: 'inventory_surplus',
      source: result.source,
      data: result.data,
    };
  }

  /**
   * Get inventory surplus for states
   */
  @Get('states')
  async getStateInventorySurplus() {
    const result = await this.inventorySurplusService.getForMap('state');

    if (!result.success || result.data.length === 0) {
      return {
        success: false,
        error: 'No inventory surplus data available for states',
        data: [],
      };
    }

    return {
      success: true,
      count: result.data.length,
      geography: 'State',
      metric: 'inventory_surplus',
      source: result.source,
      data: result.data,
    };
  }

  /**
   * Get inventory surplus for metros
   */
  @Get('metros')
  async getMetroInventorySurplus() {
    const result = await this.inventorySurplusService.getForMap('metro');

    if (!result.success || result.data.length === 0) {
      return {
        success: false,
        error: 'No inventory surplus data available for metros',
        data: [],
      };
    }

    return {
      success: true,
      count: result.data.length,
      geography: 'Metro',
      metric: 'inventory_surplus',
      source: result.source,
      data: result.data,
    };
  }

  /**
   * Get inventory surplus for counties
   */
  @Get('counties')
  async getCountyInventorySurplus() {
    const result = await this.inventorySurplusService.getForMap('county');

    if (!result.success || result.data.length === 0) {
      return {
        success: false,
        error: 'No inventory surplus data available for counties',
        data: [],
      };
    }

    return {
      success: true,
      count: result.data.length,
      geography: 'County',
      metric: 'inventory_surplus',
      source: result.source,
      data: result.data,
    };
  }

  /**
   * Get inventory surplus for zip codes
   */
  @Get('zips')
  async getZipInventorySurplus(@Query('state') state?: string) {
    const result = await this.inventorySurplusService.getForMap('zip');

    if (!result.success || result.data.length === 0) {
      return {
        success: false,
        error: 'No inventory surplus data available for zips',
        data: [],
      };
    }

    // Filter by state if provided (zip_name format: "City, ST")
    let filteredData = result.data;
    if (state) {
      const statePattern = `, ${state.toUpperCase()}`;
      filteredData = result.data.filter(
        (item: any) => item.region_name?.endsWith(statePattern)
      );
    }

    return {
      success: true,
      count: filteredData.length,
      geography: 'ZIP',
      metric: 'inventory_surplus',
      source: result.source,
      data: filteredData,
    };
  }

  // ============================================================================
  // BATCH CALCULATION ENDPOINTS
  // ============================================================================

  /**
   * Trigger batch calculation for all geographies
   */
  @Post('calculate')
  async calculateAll() {
    const results = await this.inventorySurplusService.calculateForAll();

    return {
      success: true,
      message: 'Inventory surplus batch calculation completed',
      results: {
        national: results.national,
        metros: results.metros,
        states: results.states,
        counties: results.counties,
        zips: results.zips,
      },
      totals: {
        processed:
          results.national.processed +
          results.metros.processed +
          results.states.processed +
          results.counties.processed +
          results.zips.processed,
        stored:
          results.national.stored +
          results.metros.stored +
          results.states.stored +
          results.counties.stored +
          results.zips.stored,
      },
    };
  }

  /**
   * Trigger batch calculation for a specific geography type
   */
  @Post('calculate/:geoType')
  async calculateByGeo(@Param('geoType') geoType: string) {
    let result: { processed: number; stored: number };

    switch (geoType) {
      case 'national':
        result = await this.inventorySurplusService.calculateForNational();
        break;
      case 'metros':
        result = await this.inventorySurplusService.calculateForMetros();
        break;
      case 'states':
        result = await this.inventorySurplusService.calculateForStates();
        break;
      case 'counties':
        result = await this.inventorySurplusService.calculateForCounties();
        break;
      case 'zips':
        result = await this.inventorySurplusService.calculateForZips();
        break;
      default:
        return { success: false, error: `Invalid geography type: ${geoType}` };
    }

    return {
      success: true,
      geography: geoType,
      metric: 'inventory_surplus',
      ...result,
    };
  }
}
