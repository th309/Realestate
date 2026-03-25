/**
 * Organization Members Controller
 *
 * REST endpoints for member management within an organization.
 *
 * Routes:
 *   GET    /api/org/:slug/members              — List members (member+)
 *   POST   /api/org/:slug/members/invite       — Invite a member (admin+)
 *   PUT    /api/org/:slug/members/:userId/role  — Change member role (admin+)
 *   DELETE /api/org/:slug/members/:userId       — Remove a member (admin+)
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
import { OrgContextGuard } from './guards/org-context.guard';
import { OrgAdminGuard } from './guards/org-admin.guard';
import { OrgMemberGuard } from './guards/org-member.guard';
import { MembersService } from './members.service';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@Controller('api/org')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Get(':slug/members')
  @UseGuards(JwtAuthGuard, OrgContextGuard, OrgMemberGuard)
  async listMembers(@Req() req: any) {
    const members = await this.membersService.listMembers(req.org.id);
    return { members, total: members.length };
  }

  @Post(':slug/members/invite')
  @UseGuards(JwtAuthGuard, OrgContextGuard, OrgAdminGuard)
  async inviteMember(
    @Req() req: any,
    @Body() dto: InviteMemberDto,
    @AuthUserId() userId: string,
  ) {
    return this.membersService.inviteMember(
      req.org.id,
      dto.email,
      dto.role,
      userId,
    );
  }

  @Put(':slug/members/:userId/role')
  @UseGuards(JwtAuthGuard, OrgContextGuard, OrgAdminGuard)
  async changeRole(
    @Req() req: any,
    @Param('userId') targetUserId: string,
    @Body() dto: UpdateMemberRoleDto,
    @AuthUserId() actorId: string,
  ) {
    await this.membersService.changeRole(
      req.org.id,
      targetUserId,
      dto.role,
      actorId,
    );
    return { message: 'Role updated successfully' };
  }

  @Delete(':slug/members/:userId')
  @UseGuards(JwtAuthGuard, OrgContextGuard, OrgAdminGuard)
  async removeMember(
    @Req() req: any,
    @Param('userId') targetUserId: string,
    @AuthUserId() actorId: string,
  ) {
    await this.membersService.removeMember(req.org.id, targetUserId, actorId);
    return { message: 'Member removed successfully' };
  }
}
