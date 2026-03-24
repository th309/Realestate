/**
 * Organization Embed Tokens Controller (Admin)
 *
 * CRUD endpoints for managing embed tokens within an organization.
 * All routes require JWT auth + org context + org admin role.
 *
 * Routes:
 *   GET    /api/org/:slug/embed-tokens      — List active tokens
 *   POST   /api/org/:slug/embed-tokens      — Create new token
 *   PUT    /api/org/:slug/embed-tokens/:id   — Update token
 *   DELETE /api/org/:slug/embed-tokens/:id   — Revoke token
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
import { OrgContextGuard } from '../organizations/guards/org-context.guard';
import { OrgAdminGuard } from '../organizations/guards/org-admin.guard';
import { OrgEmbedsService } from './org-embeds.service';
import { CreateEmbedTokenDto } from './dto/create-embed-token.dto';
import { UpdateEmbedTokenDto } from './dto/update-embed-token.dto';

@Controller('api/org/:slug/embed-tokens')
@UseGuards(JwtAuthGuard, OrgContextGuard, OrgAdminGuard)
export class OrgEmbedsController {
  constructor(private readonly embedsService: OrgEmbedsService) {}

  /**
   * List all active embed tokens for the organization.
   * Token values are masked for security.
   */
  @Get()
  async listTokens(@Req() request: any) {
    return this.embedsService.listTokens(request.org.id);
  }

  /**
   * Create a new embed token.
   * Returns the full token value — shown only once.
   */
  @Post()
  async createToken(
    @Req() request: any,
    @Body() dto: CreateEmbedTokenDto,
    @AuthUserId() userId: string,
  ) {
    return this.embedsService.createToken(request.org.id, dto, userId);
  }

  /**
   * Update an embed token's name, allowed origins, or widget types.
   */
  @Put(':id')
  async updateToken(
    @Req() request: any,
    @Param('id') tokenId: string,
    @Body() dto: UpdateEmbedTokenDto,
  ) {
    return this.embedsService.updateToken(request.org.id, tokenId, dto);
  }

  /**
   * Revoke (soft-delete) an embed token.
   */
  @Delete(':id')
  async revokeToken(
    @Req() request: any,
    @Param('id') tokenId: string,
    @AuthUserId() userId: string,
  ) {
    await this.embedsService.revokeToken(request.org.id, tokenId, userId);
    return { success: true };
  }
}
