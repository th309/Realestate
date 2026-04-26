import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../common/guards/admin-auth.guard';
import { PlatformManagerService } from './platform-manager.service';
import { PlatformCredentialsService } from './platform-credentials.service';
import { PlatformAppCredentialsService } from './platform-app-credentials.service';

/**
 * Admin endpoints for managing platform connections, OAuth credentials,
 * and per-platform developer app credentials (client_id + secret).
 *
 * Split from ContentPipelineController to keep that file under the 300-line
 * hard limit while the platforms surface keeps growing.
 */
@UseGuards(AdminGuard)
@Controller('api/admin/content-pipeline')
export class ContentPipelinePlatformsController {
  constructor(
    private readonly platformManager: PlatformManagerService,
    private readonly credentials: PlatformCredentialsService,
    private readonly appCredentials: PlatformAppCredentialsService,
  ) {}

  @Get('platforms')
  async platforms() {
    return {
      success: true,
      data: { platforms: await this.platformManager.getPlatformStatuses() },
    };
  }

  @Post('platforms/:platform/connect')
  async platformConnect(@Param('platform') platform: string) {
    return {
      success: true,
      data: await this.platformManager.startOAuth(platform),
    };
  }

  @Delete('platforms/:platform/credentials')
  async platformDisconnect(@Param('platform') platform: string) {
    await this.credentials.disconnect(platform);
    return { success: true, data: { disconnected: platform } };
  }

  // ── App credentials (per-platform OAuth client_id + secret) ────────────
  // Lets admins enter the developer-app credentials in the UI without
  // Railway env-var trips. Resolution is DB-first then env, so the
  // existing YouTube env-var setup keeps working unchanged.

  @Get('platforms/:platform/app-credentials')
  async getAppCredentials(@Param('platform') platform: string) {
    return { success: true, data: await this.appCredentials.status(platform) };
  }

  @Patch('platforms/:platform/app-credentials')
  async setAppCredentials(
    @Param('platform') platform: string,
    @Body() body: { clientId: string; clientSecret: string; notes?: string },
    @Req() req: Request & { user?: { id: string } },
  ) {
    if (!body?.clientId || !body?.clientSecret) {
      throw new BadRequestException('clientId and clientSecret are required');
    }
    await this.appCredentials.upsert({
      platform,
      clientId: body.clientId.trim(),
      clientSecret: body.clientSecret.trim(),
      notes: body.notes?.trim(),
      updatedBy: req.user?.id,
    });
    return {
      success: true,
      data: await this.appCredentials.status(platform),
    };
  }

  @Delete('platforms/:platform/app-credentials')
  async clearAppCredentials(@Param('platform') platform: string) {
    await this.appCredentials.clear(platform);
    return {
      success: true,
      data: await this.appCredentials.status(platform),
    };
  }
}
