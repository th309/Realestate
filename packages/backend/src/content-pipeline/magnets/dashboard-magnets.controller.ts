import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthUserId } from '../../common/decorators/auth-user';
import { DashboardMagnetsService } from './dashboard-magnets.service';

@UseGuards(JwtAuthGuard)
@Controller('api/dashboard/magnets')
export class DashboardMagnetsController {
  constructor(private readonly service: DashboardMagnetsService) {}

  @Get()
  async list(@AuthUserId() userId: string) {
    return {
      success: true,
      data: { magnets: await this.service.getUserMagnets(userId) },
    };
  }

  @Post('refresh')
  async refresh(
    @AuthUserId() userId: string,
    @Body() body: { magnetKind: string; geo: unknown },
  ) {
    await this.service.refresh(userId, body?.magnetKind, body?.geo);
    return { success: true, data: { queued: true } };
  }
}

