import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin-auth.guard';
import { StylePreferenceService } from './style-preference.service';
import {
  StylePreferenceBrandQueryDto,
  UpdateSignalWeightDto,
} from './dto/style-preference.dto';

/**
 * Admin API for the preference-learning loop: like/unlike a style reference for
 * a brand and set how strongly those likes steer generation prompts. Every
 * response returns the FULL refreshed preferences (including the exact prompt
 * block), so the UI never has to guess what generation will see next.
 */
@UseGuards(AdminGuard)
@Controller('api/admin/content-pipeline/style-preferences')
export class StylePreferenceController {
  constructor(private readonly prefs: StylePreferenceService) {}

  @Get()
  async get(@Query() query: StylePreferenceBrandQueryDto) {
    return {
      success: true,
      data: await this.prefs.getPreferences(query.brandId),
    };
  }

  @Post('saved/:styleReferenceId')
  async save(
    @Param('styleReferenceId', new ParseUUIDPipe()) styleReferenceId: string,
    @Body() body: StylePreferenceBrandQueryDto,
  ) {
    return {
      success: true,
      data: await this.prefs.saveStyleRef(styleReferenceId, body.brandId),
    };
  }

  @Delete('saved/:styleReferenceId')
  async unsave(
    @Param('styleReferenceId', new ParseUUIDPipe()) styleReferenceId: string,
    @Query() query: StylePreferenceBrandQueryDto,
  ) {
    return {
      success: true,
      data: await this.prefs.unsaveStyleRef(styleReferenceId, query.brandId),
    };
  }

  @Patch()
  async setSignalWeight(@Body() dto: UpdateSignalWeightDto) {
    return {
      success: true,
      data: await this.prefs.setSignalWeight(dto.signalWeight, dto.brandId),
    };
  }
}
