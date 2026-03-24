/**
 * Organization Branding Controller (Admin)
 *
 * Authenticated endpoints for managing organization branding:
 * logo upload/delete and accent color/website URL updates.
 *
 * Routes:
 *   GET    /api/org/:slug/branding       — Get current branding
 *   PUT    /api/org/:slug/branding       — Update accent color / website URL
 *   POST   /api/org/:slug/branding/logo  — Upload logo (max 2 MB)
 *   DELETE /api/org/:slug/branding/logo  — Delete logo
 */

import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards';
import { AuthUserId } from '../common/decorators';
import { OrgContextGuard, OrgAdminGuard } from '../organizations/guards';
import { OrgBrandingService } from './org-branding.service';
import { UpdateBrandingDto } from './dto/update-branding.dto';

@Controller('api/org/:slug/branding')
@UseGuards(JwtAuthGuard, OrgContextGuard, OrgAdminGuard)
export class OrgBrandingController {
  constructor(private readonly brandingService: OrgBrandingService) {}

  @Get()
  async getBranding(@Req() req: any) {
    return this.brandingService.getBranding(req.org.id);
  }

  @Put()
  async updateBranding(
    @Req() req: any,
    @Body() dto: UpdateBrandingDto,
    @AuthUserId() userId: string,
  ) {
    return this.brandingService.updateBranding(req.org.id, dto, userId);
  }

  @Post('logo')
  @UseInterceptors(
    FileInterceptor('logo', {
      limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
    }),
  )
  async uploadLogo(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @AuthUserId() userId: string,
  ) {
    return this.brandingService.uploadLogo(req.org.id, file, userId);
  }

  @Delete('logo')
  async deleteLogo(@Req() req: any, @AuthUserId() userId: string) {
    await this.brandingService.deleteLogo(req.org.id, userId);
    return { message: 'Logo removed' };
  }
}
