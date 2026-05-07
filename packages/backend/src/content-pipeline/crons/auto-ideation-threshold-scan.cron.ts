import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AutoIdeationService } from '../auto-ideation/auto-ideation.service';

@Injectable()
export class AutoIdeationThresholdScanCron {
  constructor(private readonly autoIdeation: AutoIdeationService) {}

  @Cron('0 * * * *')
  async run(): Promise<void> {
    await this.autoIdeation.runEnabledRules('threshold_cross');
  }
}

