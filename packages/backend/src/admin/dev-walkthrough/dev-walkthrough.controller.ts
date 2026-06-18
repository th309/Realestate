// dev-walkthrough.controller.ts
import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin-auth.guard';
import { DevWalkthroughService } from './dev-walkthrough.service';

@UseGuards(AdminGuard)
@Controller('api/admin/dev/trial-walkthrough')
export class DevWalkthroughController {
  private readonly logger = new Logger(DevWalkthroughController.name);
  constructor(private readonly svc: DevWalkthroughService) {}

  @Post('advance')
  async advance(@Body() body: { userId: string; toDay: number }) {
    const dates = await this.svc.advanceToDay(body.userId, body.toDay);
    return { success: true, data: dates };
  }

  @Post('fire')
  async fire(@Body() body: { job: string; userId: string }) {
    await this.svc.fireJob(body.job, body.userId);
    return { success: true };
  }

  @Delete('user/:userId')
  async teardown(@Param('userId') userId: string) {
    await this.svc.teardown(userId);
    return { success: true };
  }
}
