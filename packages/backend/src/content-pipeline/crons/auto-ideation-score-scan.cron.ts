import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AutoIdeationService } from '../auto-ideation/auto-ideation.service';

@Injectable()
export class AutoIdeationScoreScanCron {
  constructor(private readonly autoIdeation: AutoIdeationService) {}

  @Cron('*/30 * * * *')
  async run(): Promise<void> {
    await this.autoIdeation.runEnabledRules('score_movement');
  }
}

