import { Controller, Get, Param } from '@nestjs/common';
import { ShortLinkService } from './short-link.service';

@Controller('api/internal/short-links')
export class ShortLinkController {
  constructor(private readonly service: ShortLinkService) {}

  @Get('resolve/:slug')
  async resolve(@Param('slug') slug: string) {
    const link = await this.service.resolve(slug);
    if (!link) return { success: false, error: 'not_found' };
    return { success: true, data: link };
  }
}
