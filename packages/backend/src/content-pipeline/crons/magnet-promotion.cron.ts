import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { MagnetABPromoterService } from '../magnets/magnet-ab-promoter.service';

@Injectable()
export class MagnetPromotionCron {
  constructor(private readonly promoter: MagnetABPromoterService) {}

  @Cron('0 6 * * 1', { timeZone: 'UTC' }) // Monday 6am UTC
  async run(): Promise<void> {
    const formats = [
      'grade_reveal',
      'top_10_ranking',
      'score_mover',
      'head_to_head',
      'farm_area_spotlight',
      'long_form_deep_dive',
      'brokerage_market_share',
      'recruitment_angle',
    ];
    for (const f of formats) {
      await this.promoter.evaluate(f);
    }
  }
}

