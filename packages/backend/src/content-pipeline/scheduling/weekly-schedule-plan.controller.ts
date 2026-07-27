import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin-auth.guard';
import { WeeklySchedulePlanService } from './weekly-schedule-plan.service';
import { UpdateWeeklySchedulePlanDto } from './dto/update-weekly-schedule-plan.dto';

/**
 * Admin API for a brand's weekly auto-scheduling plan — the days and Eastern
 * times each post type goes out on, plus the kill switch. Guarded and enveloped
 * exactly like the sibling content-pipeline admin controllers.
 *
 * The plan drives PostAutoSchedulerService; editing it here changes placement
 * for every post approved afterwards, and takes effect immediately (the plan is
 * read fresh on every assignment, never cached).
 */
@UseGuards(AdminGuard)
@Controller('api/admin/content-pipeline/schedule-plan')
export class WeeklySchedulePlanController {
  constructor(private readonly plans: WeeklySchedulePlanService) {}

  /**
   * A brand's plan. Brands that have never been edited return the seeded
   * default rather than 404, so the UI always has something to render.
   */
  @Get(':brandId')
  async getPlan(@Param('brandId', new ParseUUIDPipe()) brandId: string) {
    return { success: true, data: await this.plans.getPlan(brandId) };
  }

  /**
   * Replace part or all of a brand's plan. Omitted fields keep their current
   * value, so `{ "enabled": false }` is a valid request that only flips the
   * kill switch.
   */
  @Put(':brandId')
  async updatePlan(
    @Param('brandId', new ParseUUIDPipe()) brandId: string,
    @Body() dto: UpdateWeeklySchedulePlanDto,
  ) {
    return { success: true, data: await this.plans.updatePlan(brandId, dto) };
  }
}
