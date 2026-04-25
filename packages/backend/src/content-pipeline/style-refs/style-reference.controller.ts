import {
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
import type { Request } from 'express';
import { AdminGuard } from '../../common/guards/admin-auth.guard';
import { StyleReferenceService } from './style-reference.service';
import {
  CreateStyleReferenceDto,
  UpdateStyleReferenceDto,
} from '../dto/style-reference.dto';

interface AuthenticatedRequest extends Request {
  user?: { id: string };
}

@UseGuards(AdminGuard)
@Controller('api/admin/content-pipeline/style-references')
export class StyleReferenceController {
  constructor(private readonly svc: StyleReferenceService) {}

  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    return {
      success: true,
      data: { references: await this.svc.list(req.user?.id ?? null) },
    };
  }

  @Post()
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateStyleReferenceDto,
  ) {
    if (!req.user?.id) {
      return { success: false, error: 'unauthenticated' };
    }
    return { success: true, data: await this.svc.create(req.user.id, dto) };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateStyleReferenceDto) {
    return { success: true, data: await this.svc.update(id, dto) };
  }

  @Post(':id/re-extract')
  async reExtract(@Param('id') id: string) {
    return { success: true, data: await this.svc.reExtract(id) };
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.svc.delete(id);
    return { success: true, data: { deleted: true } };
  }
}
