import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards';
import { AuthUserId } from '../common/decorators';
import { UsageCoverageService } from './usage-coverage.service';

/**
 * GET /api/usage/coverage — the authenticated user's feature-coverage signal
 * (used `feature.*` actions + whether MCP is connected). Drives the dashboard
 * next-best-move surface and checklist auto-completion.
 */
@UseGuards(JwtAuthGuard)
@Controller('api/usage')
export class UsageCoverageController {
  constructor(private readonly coverage: UsageCoverageService) {}

  @Get('coverage')
  async getCoverage(@AuthUserId() userId: string) {
    return { success: true, data: await this.coverage.getCoverage(userId) };
  }
}
