/**
 * AppConfig Controller
 *
 * Admin-only endpoints for reading and updating app_config settings.
 */

import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Req,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { IsString, IsNotEmpty } from 'class-validator';
import { AppConfigService } from './app-config.service';
import { AdminGuard } from '../common/guards/admin-auth.guard';

export class UpdateConfigDto {
  @IsString()
  @IsNotEmpty()
  value: string;
}

@UseGuards(AdminGuard)
@Controller('api/admin/config')
export class AppConfigController {
  private readonly logger = new Logger(AppConfigController.name);

  constructor(private readonly appConfigService: AppConfigService) {}

  /**
   * GET /api/admin/config/:category
   * Returns all config entries for a given category.
   */
  @Get(':category')
  async getByCategory(@Param('category') category: string) {
    this.logger.log(`GET /api/admin/config/${category}`);
    const entries = await this.appConfigService.getAllByCategory(category);
    return {
      success: true,
      data: entries,
      count: entries.length,
    };
  }

  /**
   * PUT /api/admin/config/:key
   * Update a single config value. Requires { value: string } in the body.
   */
  @Put(':key')
  async updateKey(
    @Param('key') key: string,
    @Body() body: UpdateConfigDto,
    @Req() req: any,
  ) {
    this.logger.log(`PUT /api/admin/config/${key}`);
    const updatedBy: string = req.userId ?? 'unknown';
    await this.appConfigService.set(key, body.value, updatedBy);
    return {
      success: true,
      updated: { key, value: body.value },
    };
  }
}
