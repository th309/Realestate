import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin-auth.guard';
import { BrandKitService } from './brand-kit.service';
import { UpdateBrandDto } from './dto/update-brand.dto';

/**
 * Admin brand-kit API. GET /brands seeds + returns the singleton PropertyIQ
 * brand on first use. The response envelope matches the sibling content-pipeline
 * controllers ({ success, data }).
 */
@UseGuards(AdminGuard)
@Controller('api/admin/content-pipeline/brands')
export class BrandKitController {
  constructor(private readonly brandKit: BrandKitService) {}

  /** List all brands, seeding the PropertyIQ default if none exist yet. */
  @Get()
  async list() {
    await this.brandKit.ensurePropertyIqBrand();
    return {
      success: true,
      data: { brands: await this.brandKit.listBrands() },
    };
  }

  /** The default (PropertyIQ) brand profile a generator would use. */
  @Get('default')
  async getDefault() {
    return { success: true, data: await this.brandKit.getBrandProfile() };
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    return { success: true, data: await this.brandKit.getBrandProfile(id) };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateBrandDto) {
    return {
      success: true,
      data: await this.brandKit.updateBrand(id, dto),
    };
  }
}
