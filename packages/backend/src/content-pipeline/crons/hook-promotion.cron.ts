import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HookPromoterService } from '../analytics/hook-promoter.service';

@Injectable()
export class HookPromotionCron {
  constructor(private readonly promoter: HookPromoterService) {}

  @Cron('0 4 * * 1', { timeZone: 'UTC' }) // Monday 4am UTC
  async run(): Promise<void> {
    const formats = [
      'grade_reveal',
      'top_10_ranking',
      'bottom_10_ranking',
      'score_mover',
      'head_to_head',
      'long_form_deep_dive',
      'farm_area_spotlight',
      'brokerage_market_share',
      'recruitment_angle',
    ];
    for (const f of formats) {
      await this.promoter.evaluate(f);
    }
  }
}

