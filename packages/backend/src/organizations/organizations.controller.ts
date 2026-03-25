/**
 * Organizations Controller
 *
 * REST endpoints for organization CRUD operations.
 *
 * Routes:
 *   POST   /api/org              — Create a new organization
 *   GET    /api/org/:slug        — Get organization by slug (member+)
 *   PUT    /api/org/:slug        — Update organization (admin+)
 *   PUT    /api/org/:slug/transfer-ownership — Transfer ownership (admin+)
 */

import {
  Controller,
  Post,
  Get,
  Put,
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
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { TransferOwnershipDto } from './dto/transfer-ownership.dto';

@Controller('api/org')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() dto: CreateOrganizationDto,
    @AuthUserId() userId: string,
  ) {
    return this.organizationsService.create(dto, userId);
  }

  @Get('mine')
  @UseGuards(JwtAuthGuard)
  async getMyOrg(@AuthUserId() userId: string) {
    const org = await this.organizationsService.findByUserId(userId);
    return org ?? { slug: null, name: null, role: null };
  }

  @Get(':slug')
  @UseGuards(JwtAuthGuard, OrgContextGuard, OrgMemberGuard)
  async getOrg(@Param('slug') slug: string, @AuthUserId() userId: string) {
    const org = await this.organizationsService.getBySlug(slug);
    // Include the caller's membership role so the frontend OrgContextProvider
    // can gate admin-only pages without a second API call.
    const role = await this.organizationsService.getMemberRole(org.id, userId);
    return { ...org, role };
  }

  @Put(':slug')
  @UseGuards(JwtAuthGuard, OrgContextGuard, OrgAdminGuard)
  async updateOrg(
    @Req() req: any,
    @Body() dto: UpdateOrganizationDto,
    @AuthUserId() userId: string,
  ) {
    return this.organizationsService.update(req.org.id, dto, userId);
  }

  @Put(':slug/transfer-ownership')
  @UseGuards(JwtAuthGuard, OrgContextGuard, OrgAdminGuard)
  async transferOwnership(
    @Req() req: any,
    @Body() dto: TransferOwnershipDto,
    @AuthUserId() userId: string,
  ) {
    await this.organizationsService.transferOwnership(
      req.org.id,
      dto.newOwnerId,
      userId,
    );
    return { message: 'Ownership transferred successfully' };
  }
}
