import { Controller, Get, Header, Inject, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.service';
import {
  getAffordableHomePriceByGeo,
  getIncomeToBuyByGeo,
  getYearsToSaveByGeo,
} from './metrics-affordability.helper';

@ApiTags('metrics')
@Controller('api/metrics')
export class MetricsAffordabilityController {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly supabase: SupabaseClient,
  ) {}

  // ============================================================================
  // INCOME-TO-BUY ENDPOINTS (from pre-calculated data)
  // ============================================================================

  /**
   * Get income-to-buy for national
   */
  @Get('income-to-buy/national')
  @Header('Cache-Control', 'public, max-age=21600')
  async getNationalIncomeToBuy() {
    return getIncomeToBuyByGeo(this.supabase, 'national', 'National');
  }

  /**
   * Get income-to-buy for states
   * Returns the annual income required to afford the median-priced home
   */
  @Get('income-to-buy/states')
  @Header('Cache-Control', 'public, max-age=21600')
  async getStateIncomeToBuy() {
    return getIncomeToBuyByGeo(this.supabase, 'state', 'State');
  }

  /**
   * Get income-to-buy for metros
   */
  @Get('income-to-buy/metros')
  @Header('Cache-Control', 'public, max-age=21600')
  async getMetroIncomeToBuy() {
    return getIncomeToBuyByGeo(this.supabase, 'metro', 'Metro');
  }

  /**
   * Get income-to-buy for counties
   */
  @Get('income-to-buy/counties')
  @Header('Cache-Control', 'public, max-age=21600')
  async getCountyIncomeToBuy() {
    return getIncomeToBuyByGeo(this.supabase, 'county', 'County');
  }

  /**
   * Get income-to-buy for zip codes
   */
  @Get('income-to-buy/zips')
  @Header('Cache-Control', 'public, max-age=21600')
  async getZipIncomeToBuy(@Query('state') state?: string) {
    return getIncomeToBuyByGeo(this.supabase, 'zip', 'ZIP', state);
  }

  // ============================================================================
  // AFFORDABLE-HOME-PRICE ENDPOINTS (from pre-calculated data)
  // ============================================================================

  /**
   * Get affordable-home-price for national
   */
  @Get('affordable-home-price/national')
  @Header('Cache-Control', 'public, max-age=21600')
  async getNationalAffordableHomePrice() {
    return getAffordableHomePriceByGeo(this.supabase, 'national', 'National');
  }

  /**
   * Get affordable-home-price for states
   * Returns the maximum home price affordable based on median household income
   */
  @Get('affordable-home-price/states')
  @Header('Cache-Control', 'public, max-age=21600')
  async getStateAffordableHomePrice() {
    return getAffordableHomePriceByGeo(this.supabase, 'state', 'State');
  }

  /**
   * Get affordable-home-price for metros
   */
  @Get('affordable-home-price/metros')
  @Header('Cache-Control', 'public, max-age=21600')
  async getMetroAffordableHomePrice() {
    return getAffordableHomePriceByGeo(this.supabase, 'metro', 'Metro');
  }

  /**
   * Get affordable-home-price for counties
   */
  @Get('affordable-home-price/counties')
  @Header('Cache-Control', 'public, max-age=21600')
  async getCountyAffordableHomePrice() {
    return getAffordableHomePriceByGeo(this.supabase, 'county', 'County');
  }

  /**
   * Get affordable-home-price for zip codes
   */
  @Get('affordable-home-price/zips')
  @Header('Cache-Control', 'public, max-age=21600')
  async getZipAffordableHomePrice(@Query('state') state?: string) {
    return getAffordableHomePriceByGeo(this.supabase, 'zip', 'ZIP', state);
  }

  // ============================================================================
  // YEARS-TO-SAVE ENDPOINTS (from pre-calculated data)
  // Formula: (Median listing price × 0.20) / (Median Income × 0.10)
  // ============================================================================

  /**
   * Get years-to-save for national
   */
  @Get('years-to-save/national')
  @Header('Cache-Control', 'public, max-age=21600')
  async getNationalYearsToSave() {
    return getYearsToSaveByGeo(this.supabase, 'national', 'National');
  }

  /**
   * Get years-to-save for states
   * Returns the number of years needed to save for a 20% down payment
   */
  @Get('years-to-save/states')
  @Header('Cache-Control', 'public, max-age=21600')
  async getStateYearsToSave() {
    return getYearsToSaveByGeo(this.supabase, 'state', 'State');
  }

  /**
   * Get years-to-save for metros
   */
  @Get('years-to-save/metros')
  @Header('Cache-Control', 'public, max-age=21600')
  async getMetroYearsToSave() {
    return getYearsToSaveByGeo(this.supabase, 'metro', 'Metro');
  }

  /**
   * Get years-to-save for counties
   */
  @Get('years-to-save/counties')
  @Header('Cache-Control', 'public, max-age=21600')
  async getCountyYearsToSave() {
    return getYearsToSaveByGeo(this.supabase, 'county', 'County');
  }

  /**
   * Get years-to-save for zip codes
   */
  @Get('years-to-save/zips')
  @Header('Cache-Control', 'public, max-age=21600')
  async getZipYearsToSave(@Query('state') state?: string) {
    return getYearsToSaveByGeo(this.supabase, 'zip', 'ZIP', state);
  }
}
