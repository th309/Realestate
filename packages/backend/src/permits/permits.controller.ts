import { Controller, Get, Query } from '@nestjs/common';
import { PermitsService } from './permits.service';

@Controller('api/permits')
export class PermitsController {
  constructor(private readonly permitsService: PermitsService) {}

  // ============================================================================
  // Base Permits Data (sf_units, large_multi_units, total_units)
  // ============================================================================

  @Get('states')
  async getStatePermits() {
    return this.permitsService.getStatePermits();
  }

  @Get('counties')
  async getCountyPermits(@Query('state') state?: string) {
    return this.permitsService.getCountyPermits(state);
  }

  // ============================================================================
  // SF/MF Ratio (calculated)
  // ============================================================================

  @Get('sf-ratio/states')
  async getStateSfRatio() {
    return this.permitsService.getStateSfRatio();
  }

  @Get('sf-ratio/counties')
  async getCountySfRatio(@Query('state') state?: string) {
    return this.permitsService.getCountySfRatio(state);
  }

  // ============================================================================
  // Value Per Unit (calculated)
  // ============================================================================

  @Get('value-per-unit/states')
  async getStateValuePerUnit() {
    return this.permitsService.getStateValuePerUnit();
  }

  @Get('value-per-unit/counties')
  async getCountyValuePerUnit(@Query('state') state?: string) {
    return this.permitsService.getCountyValuePerUnit(state);
  }
}
