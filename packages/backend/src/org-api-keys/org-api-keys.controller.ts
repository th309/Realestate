/**
 * Organization API Keys Controller (Admin)
 *
 * CRUD endpoints for managing Platform API keys within an organization.
 * All routes require JWT authentication + org admin role.
 *
 * Routes:
 *   GET    /api/org/:slug/api-keys       — List active keys (prefix only)
 *   POST   /api/org/:slug/api-keys       — Create key (returns full key ONCE)
 *   PUT    /api/org/:slug/api-keys/:id   — Update key name/scopes/rate limit
 *   DELETE /api/org/:slug/api-keys/:id   — Revoke key (soft delete)
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards';
import { AuthUserId } from '../common/decorators';
import { OrgContextGuard, OrgAdminGuard } from '../organizations/guards';
import { OrgApiKeysService } from './org-api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { UpdateApiKeyDto } from './dto/update-api-key.dto';

@Controller('api/org/:slug/api-keys')
@UseGuards(JwtAuthGuard, OrgContextGuard, OrgAdminGuard)
export class OrgApiKeysController {
  constructor(private readonly apiKeysService: OrgApiKeysService) {}

  @Get()
  async listKeys(@Req() req: any) {
    return this.apiKeysService.listKeys(req.org.id);
  }

  @Post()
  async createKey(
    @Req() req: any,
    @Body() dto: CreateApiKeyDto,
    @AuthUserId() userId: string,
  ) {
    return this.apiKeysService.createKey(req.org.id, dto, userId);
  }

  @Put(':id')
  async updateKey(
    @Req() req: any,
    @Param('id') keyId: string,
    @Body() dto: UpdateApiKeyDto,
  ) {
    return this.apiKeysService.updateKey(req.org.id, keyId, dto);
  }

  @Delete(':id')
  async revokeKey(
    @Req() req: any,
    @Param('id') keyId: string,
    @AuthUserId() userId: string,
  ) {
    await this.apiKeysService.revokeKey(req.org.id, keyId, userId);
    return { success: true };
  }
}
