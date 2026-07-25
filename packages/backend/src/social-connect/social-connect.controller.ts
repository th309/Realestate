import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../common/guards/admin-auth.guard';
import { SocialConnectService } from './social-connect.service';
import { LateNotConfiguredError } from './late-client.types';
import { ConnectLinkDto } from './dto/connect-link.dto';
import { ListConnectionsQueryDto } from './dto/list-connections.query.dto';
import { SyncConnectionsDto } from './dto/sync-connections.dto';

/**
 * Admin endpoints for one-click social-account connection via the Late
 * aggregator. Guarded exactly like the sibling content-pipeline admin
 * controllers (AdminGuard). Every response uses the `{ success, data }`
 * envelope the frontend expects — including the not-configured 503, which is
 * `{ success: false, error: <setup> }`.
 *
 * NOT wired into any module import yet — the team lead adds the single
 * `SocialConnectModule` import after all Phase 3 agents finish (see report).
 */
@UseGuards(AdminGuard)
@Controller('api/admin/social-connect')
export class SocialConnectController {
  constructor(private readonly service: SocialConnectService) {}

  /** List stored connections, with live status overlaid when Late is configured. */
  @Get('connections')
  async list(@Query() query: ListConnectionsQueryDto) {
    return {
      success: true,
      data: await this.service.listConnections(query.brandId),
    };
  }

  /** Return the hosted Late OAuth URL the browser opens in a popup. */
  @Post('connections/connect-link')
  async connectLink(@Body() body: ConnectLinkDto) {
    try {
      const data = await this.service.createConnectLink({
        platform: body.platform,
        brandId: body.brandId,
        redirectUrl: body.redirectUrl,
      });
      return { success: true, data };
    } catch (err) {
      throw this.mapNotConfigured(err);
    }
  }

  /**
   * Disconnect a connection the brand owns. `:id` is UUID-validated (bare param
   * strings bypass the global ValidationPipe) and the operation is tenant-scoped
   * by brandId (service-role client bypasses RLS).
   */
  @Delete('connections/:id')
  async disconnect(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('brandId', new ParseUUIDPipe()) brandId: string,
  ) {
    return { success: true, data: await this.service.disconnect(id, brandId) };
  }

  /** Reconcile Late's connected accounts into `platform_connections`. */
  @Post('connections/sync')
  async sync(@Body() body: SyncConnectionsDto) {
    const brandId =
      body.brandId ?? process.env.SOCIAL_CONNECT_DEFAULT_BRAND_ID?.trim();
    if (!brandId) {
      throw new BadRequestException(
        'brandId is required to persist connections (platform_connections.brand_id is NOT NULL)',
      );
    }
    try {
      return { success: true, data: await this.service.syncFromLate(brandId) };
    } catch (err) {
      throw this.mapNotConfigured(err);
    }
  }

  /**
   * Turn a missing-key error into a structured 503 that keeps the `{ success }`
   * envelope; rethrow anything else. Shared so the future publish route inherits
   * the exact same shape.
   */
  private mapNotConfigured(err: unknown): unknown {
    if (err instanceof LateNotConfiguredError) {
      return new ServiceUnavailableException({
        success: false,
        error: this.service.setup(),
      });
    }
    return err;
  }
}
