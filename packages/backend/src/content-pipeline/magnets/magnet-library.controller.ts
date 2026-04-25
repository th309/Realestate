import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin-auth.guard';
import { MagnetLibraryService } from './magnet-library.service';
import { UpdateMagnetDto } from '../dto/update-magnet.dto';
import { BindMagnetDto, UpdateBindingDto } from '../dto/bind-magnet.dto';

@UseGuards(AdminGuard)
@Controller('api/admin/content-pipeline/magnets')
export class MagnetLibraryController {
  constructor(private readonly svc: MagnetLibraryService) {}

  @Get()
  async list() {
    return {
      success: true,
      data: {
        magnets: await this.svc.listMagnets(),
        bindings: await this.svc.listBindings(),
      },
    };
  }

  @Patch(':kind')
  async updateMagnet(
    @Param('kind') kind: string,
    @Body() dto: UpdateMagnetDto,
  ) {
    return { success: true, data: await this.svc.updateMagnet(kind, dto) };
  }

  @Post('bindings')
  async createBinding(@Body() dto: BindMagnetDto) {
    return { success: true, data: await this.svc.createBinding(dto) };
  }

  @Patch('bindings/:id')
  async updateBinding(@Param('id') id: string, @Body() dto: UpdateBindingDto) {
    return { success: true, data: await this.svc.updateBinding(id, dto) };
  }

  @Delete('bindings/:id')
  async deleteBinding(@Param('id') id: string) {
    await this.svc.deleteBinding(id);
    return { success: true, data: { deleted: true } };
  }
}
