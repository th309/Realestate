import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin-auth.guard';
import { ResolveScopeDto } from '../dto/resolve-scope.dto';
import { ScopeService } from './scope.service';

/**
 * Resolve a scope spec (metros-in-state, zips-in-metro, custom list...) to
 * a concrete list of markets. Used by the batch-mode wizard checklist.
 *
 * POST (not GET) because the body can hold a custom-list array of up to
 * 1000 codes — that hits URL length limits on GET.
 */
@UseGuards(AdminGuard)
@Controller('api/admin/content-pipeline/scope')
export class ScopeController {
  constructor(private readonly scope: ScopeService) {}

  @Post('resolve')
  async resolve(@Body() dto: ResolveScopeDto) {
    return { success: true, data: await this.scope.resolve(dto) };
  }
}
