/**
 * Organization Invites Controller
 *
 * Public and authenticated endpoints for invite token handling.
 * These routes live outside the org-slug context — they operate on tokens.
 *
 * Routes:
 *   GET  /api/org/invite/:token        — Get invite details (public)
 *   POST /api/org/invite/:token/accept — Accept an invite (authenticated)
 */

import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards';
import { AuthUserId } from '../common/decorators';
import { InvitesService } from './invites.service';

@Controller('api/org/invite')
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Get(':token')
  async getInviteDetails(@Param('token') token: string) {
    return this.invitesService.getInviteByToken(token);
  }

  @Post(':token/accept')
  @UseGuards(JwtAuthGuard)
  async acceptInvite(
    @Param('token') token: string,
    @AuthUserId() userId: string,
  ) {
    const orgSlug = await this.invitesService.acceptInvite(token, userId);
    return { message: 'Invite accepted', orgSlug };
  }
}
