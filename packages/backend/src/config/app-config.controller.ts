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
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AppConfigService } from './app-config.service';
import { AdminGuard } from '../common/guards/admin-auth.guard';

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

    try {
      const entries = await this.appConfigService.getAllByCategory(category);
      return {
        success: true,
        data: entries,
        count: entries.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * PUT /api/admin/config/:key
   * Update a single config value. Requires { value: string } in the body.
   */
  @Put(':key')
  async updateKey(
    @Param('key') key: string,
    @Body() body: { value: string },
    @Req() req: any,
  ) {
    this.logger.log(`PUT /api/admin/config/${key}`);

    if (body.value === undefined || body.value === null) {
      throw new HttpException('value is required', HttpStatus.BAD_REQUEST);
    }

    const updatedBy: string = req.userId ?? 'unknown';

    try {
      await this.appConfigService.set(key, String(body.value), updatedBy);
      return {
        success: true,
        updated: { key, value: body.value },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
